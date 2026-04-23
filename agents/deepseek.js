const axios = require('axios');

async function askDeepSeek(systemPrompt, userMessage, options = {}) {
  try {
    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userMessage  }
        ],
        max_tokens: 500,
        temperature: 0.7,
        ...options
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );
    return response.data.choices[0].message.content;
  } catch (err) {
    console.error('DeepSeek error:', err.message);
    return null;
  }
}

module.exports = { askDeepSeek };
