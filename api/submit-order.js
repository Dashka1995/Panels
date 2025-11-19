export default async function handler(req, res) {
    // 1. Разрешаем только метод POST
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
  
    // 2. Получаем ключи из настроек Vercel
    const API_KEY = process.env.KEYCRM_TOKEN; 
    const SOURCE_ID = process.env.KEYCRM_SOURCE_ID;
  
    if (!API_KEY || !SOURCE_ID) {
      console.error('KeyCRM settings are missing');
      return res.status(500).json({ error: 'Server configuration error' });
    }
  
    // 3. Получаем данные от фронтенда
    const { userData, cart, honeypot } = req.body;
  
    // --- ЗАЩИТА ОТ СПАМА (Honeypot) ---
    // Если поле honeypot заполнено, значит это бот.
    // Возвращаем "Успех", но ничего не отправляем в CRM.
    if (honeypot && honeypot.length > 0) {
      console.log('Bot detected via honeypot');
      return res.status(200).json({ success: true, message: 'Order received' });
    }
  
    // Валидация обязательных полей
    if (!userData || !userData.phone || !cart || cart.length === 0) {
      return res.status(400).json({ error: 'Missing required data' });
    }
  
    // 4. Формируем товары в формате KeyCRM
    const productsForKeyCRM = cart.map(item => ({
      sku: item.id,            // Артикул (наш id товара)
      price: item.price,       // Цена
      quantity: 1,             // Количество (у нас пока всегда 1)
      name: item.name,         // Название
      picture: item.image,     // Ссылка на картинку
      unit_type: "шт"          // Единица измерения
    }));
  
    // 5. Собираем итоговый JSON для KeyCRM
    const orderPayload = {
      source_id: Number(SOURCE_ID), // ID источника в KeyCRM
      buyer_comment: userData.comment || "",
      buyer: {
        full_name: userData.username,
        phone: userData.phone
      },
      products: productsForKeyCRM
      // Можно добавить shipping (доставку) и payments (оплату), если нужно
    };
  
    try {
      // 6. Отправляем запрос в KeyCRM
      const crmResponse = await fetch('https://openapi.keycrm.app/v1/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`,
          'Accept': 'application/json'
        },
        body: JSON.stringify(orderPayload)
      });
  
      if (!crmResponse.ok) {
        const errorText = await crmResponse.text();
        console.error('KeyCRM Error Response:', errorText);
        return res.status(500).json({ error: 'Failed to send order to CRM' });
      }
  
      const result = await crmResponse.json();
      console.log('Order created in KeyCRM:', result.id);
      
      // 7. Отвечаем фронтенду
      return res.status(200).json({ success: true, order_id: result.id });
  
    } catch (error) {
      console.error('Function Internal Error:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }