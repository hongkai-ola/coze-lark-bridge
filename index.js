const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

app.post('/webhook', async (req, res) => {
  try {
    // 1. 响应 Lark 的网址验证 (Challenge)
    if (req.body && req.body.challenge) {
      return res.status(200).json({ challenge: req.body.challenge });
    }

    const event = req.body && req.body.event;

    // 2. 收到 Lark 群消息时触发
    if (event && event.message && event.message.message_type === 'text') {
      const rawText = JSON.parse(event.message.content).text;
      const cleanQuery = rawText.replace(/@_user_\d+/g, '').trim();

      if (cleanQuery) {
        // 3. 调用扣子 API
        const cozeRes = await axios.post(
          'https://api.coze.cn/open_api/v2/chat',
          {
            bot_id: process.env.COZE_BOT_ID,
            user: event.sender.sender_id.open_id || 'lark_user',
            query: cleanQuery,
            stream: false
          },
          {
            headers: {
              'Authorization': `Bearer ${process.env.COZE_PAT}`,
              'Content-Type': 'application/json'
            }
          }
        );

        let answer = '扣子未返回答案';
        if (cozeRes.data && cozeRes.data.messages) {
          const ansObj = cozeRes.data.messages.find(m => m.type === 'answer');
          if (ansObj) answer = ansObj.content;
        }

        // 4. 获取 Lark Token 并回复
        const tokenRes = await axios.post('https://open.larksuite.com/open-apis/auth/v3/tenant_access_token/internal', {
          app_id: process.env.LARK_APP_ID,
          app_secret: process.env.LARK_APP_SECRET
        });
        const tenantToken = tokenRes.data.tenant_access_token;

        await axios.post(
          `https://open.larksuite.com/open-apis/im/v1/messages/${event.message.message_id}/reply`,
          {
            msg_type: 'text',
            content: JSON.stringify({ text: answer })
          },
          {
            headers: { 'Authorization': `Bearer ${tenantToken}` }
          }
        );
      }
    }
    return res.status(200).send('SUCCESS');
  } catch (error) {
    console.error('Error:', error.message);
    return res.status(200).send('ERROR');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
