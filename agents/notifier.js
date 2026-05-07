const axios = require('axios');

function tgUrl() {
  return `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}`;
}

async function pushToChat(chatId, text) {
  try {
    await axios.post(`${tgUrl()}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    });
  } catch (e) {
    console.error(`[Notifier] push to ${chatId} failed:`, e.message);
  }
}

module.exports = { pushToChat };
