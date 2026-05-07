const axios = require('axios');

async function askDeepSeek(systemPrompt, userMessage, options = {}) {
  const { history = [], ...restOptions } = options;
  try {
    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...history,
          { role: 'user',   content: userMessage  }
        ],
        max_tokens: 1200,
        temperature: 0.7,
        ...restOptions
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 20000
      }
    );
    return response.data.choices[0].message.content;
  } catch (err) {
    console.error('DeepSeek error:', err.message);
    return null;
  }
}

module.exports = { askDeepSeek };
