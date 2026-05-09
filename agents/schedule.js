const { askDeepSeek } = require('./deepseek');
const { state, logActivity } = require('../data/state');

const SYSTEM = `You are the Schedule Agent for Agenticthon hackathon.
Your ONLY job: answer questions about the event schedule, session times, workshop details, reminders, and personalized session recommendations.

LANGUAGE RULE (CRITICAL): Detect the language of the user's message and reply ENTIRELY in that language. Arabic → Arabic. English → English. Any language → same language. Never mix.

OUTPUT FORMAT:
• Start with "📅 [Schedule label in the user's language]:" on its own line
• Arabic label: وكيل الجدول | English label: Schedule Agent
• Bold key values: **10:00**, **ورشة الأمن**
• List items as: • **HH:MM** — Title — Hall
• Max 10 lines. Use bullet list, not paragraphs.

EVENT PHASE BEHAVIOR:
- before: suggest planning a personal agenda based on interests
- during: show NEXT upcoming sessions first, highlight sessions relevant to the user's skill
- after: show what the user may have missed, highlight recordings/resources

EXAMPLE — Arabic "متى أول جلسة؟":
📅 وكيل الجدول:

• **10:00** — وصول الفرق والتسجيل — المدخل الرئيسي
• **13:00** — حفل الافتتاح — الصالة الرياضية

EXAMPLE — English "what's next?":
📅 Schedule Agent:

• **16:00** — AI Agent Security Workshop — Work Halls
• **17:00** — AI in Microbiology — Work Halls`;

function buildContext(eventPhase, userProfile = {}) {
  const now = new Date();
  const currentHHMM = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  const scheduleText = state.schedule.map(item => {
    const dayTag = item.day ? `اليوم${item.day} ` : '';
    const displayTitle = item.titleAr ? `${item.titleAr} / ${item.title}` : item.title;
    const isUpcoming = item.time >= currentHHMM ? '⏰ UPCOMING' : '✅ PAST';
    const skillTag = item.relevantSkills && item.relevantSkills.length > 0
      ? ` | مناسب لـ: ${item.relevantSkills.join(', ')}`
      : ' | (عام للجميع)';
    return `[${item.type}] ${dayTag}${item.time} ${isUpcoming} — ${displayTitle} | قاعة: ${item.hall}` +
      (item.speaker ? ` | المحاضر: ${item.speaker}` : '') +
      skillTag;
  }).join('\n');

  const userSkillNote = userProfile.skill
    ? `\nCURRENT USER SKILL: ${userProfile.skill} — prioritize sessions matching this skill`
    : '';

  return `
=== EVENT PHASE: ${eventPhase.toUpperCase()} ===
Current Time: ${currentHHMM} AST (GMT+3)
${userSkillNote}

=== FULL SCHEDULE ===
${scheduleText}`;
}

async function handle(message, ctx = {}) {
  const { history = [], userProfile = {}, eventPhase = state.eventPhase } = ctx;
  logActivity('ScheduleAgent', 'يعالج سؤالاً', message.substring(0, 50));
  const answer = await askDeepSeek(
    SYSTEM + buildContext(eventPhase, userProfile),
    message,
    { temperature: 0.5, history }
  );
  if (answer) logActivity('ScheduleAgent', 'أجاب', message.substring(0, 40));
  return answer;
}

module.exports = { handle };
