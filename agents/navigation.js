const { askDeepSeek } = require('./deepseek');
const { state, logActivity } = require('../data/state');
const { checkParkingLoad } = require('./registrar');

const SYSTEM = `You are the Navigation Agent for Agenticthon hackathon.
Your ONLY job: answer questions about venue location, parking, hall/room directions, crowd status, and how to get to the event.

LANGUAGE RULE (CRITICAL): Detect the language of the user's message and reply ENTIRELY in that language. Arabic → Arabic. English → English. Any language → same language. Never mix.

OUTPUT FORMAT:
• Start with "🧭 [Navigation label in the user's language]:" on its own line
• Arabic label: وكيل الملاحة | English label: Navigation Agent
• Bold key values: **P1**, **المدخل الشمالي**
• List items as bullets
• Max 8 lines. Use bullet list, not paragraphs.

EXAMPLE — Arabic "وين المواقف؟":
🧭 وكيل الملاحة:

• **P1** — المدخل الشمالي — 150 سيارة
• **P2** — المدخل الجنوبي — 80 سيارة (بديل)

EXAMPLE — English "where is the parking?":
🧭 Navigation Agent:

• **P1** — North Entrance — 150 spots
• **P2** — South Entrance — 80 spots (backup)`;

const MAPS_BLOCK = `\n\n🧭 **الملاحة الفورية:**\n• [🗺 افتح في خرائط Google](https://maps.google.com/?q=جامعة+الأمير+سطام+بن+عبدالعزيز+الخرج+الصالة+الرياضية)\n• [🚗 افتح في Waze](https://waze.com/ul?q=Prince+Sattam+University+Sports+Hall+Al-Kharj)`;

const LOCATION_PATTERN = /موقع|كيف أصل|كيف اصل|طريق|اتجاه|مكان|وين|أين|الصالة|الجامعة|location|direction|how to get|venue|where|parking|مواقف|waze|maps|navigation|خريطة|map/i;

function buildContext() {
  const parkingInfo = checkParkingLoad();
  const pct = state.stats.registered > 0
    ? Math.round((state.stats.checkedIn / state.stats.registered) * 100)
    : 0;

  const hallLines = Object.entries(state.hallCounts)
    .map(([hall, count]) => `  ${hall}: ${count} شخص`)
    .join('\n') || '  (لا بيانات حية متاحة)';

  return `
=== VENUE ===
الاسم: الصالة الرياضية – جامعة الأمير سطام بن عبدالعزيز، الخرج
العنوان: الخرج، المملكة العربية السعودية

=== PARKING ===
P1 — المدخل الشمالي: 150 سيارة
P2 — المدخل الجنوبي: 80 سيارة (بديل عند امتلاء P1)
تقدير الازدحام: ~${pct}% امتلاء

=== HALL COUNTS (LIVE) ===
${hallLines}

NOTE: Do NOT include any URLs or links in your response. Navigation links will be provided separately by the system.`;
}

async function handle(message, ctx = {}) {
  const { history = [], userProfile = {} } = ctx;
  logActivity('NavigationAgent', 'يعالج سؤالاً', message.substring(0, 50));

  const answer = await askDeepSeek(SYSTEM + buildContext(), message, { temperature: 0.4, history });

  if (answer && LOCATION_PATTERN.test(message)) {
    const enriched = answer + MAPS_BLOCK;
    logActivity('NavigationAgent', 'أجاب', message.substring(0, 40));
    return enriched;
  }

  if (answer) logActivity('NavigationAgent', 'أجاب', message.substring(0, 40));
  return answer;
}

module.exports = { handle };
