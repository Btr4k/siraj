const { askDeepSeek } = require('./deepseek');
const { state, logActivity } = require('../data/state');

const SYSTEM = `You are the Guidance & Venue Agent for Agenticthon hackathon.
Your ONLY job: answer questions about event schedule, competition tracks, venue location, parking, Wi-Fi, directions, and general event information.
Reply in the SAME language as the user. NEVER mix languages in one sentence.

OUTPUT FORMAT:
• Start with "📍 وكيل التوجيه:" or "📍 Guidance Agent:" on its own line
• Bold key values: **09:00**, **Siraj-Event**, **الصالة الرياضية**
• List items as: • **Time** — Activity — Hall
• Max 8 lines. Use bullet list, not paragraphs.

EXAMPLE — "ما جدول اليوم؟":
📍 وكيل التوجيه:

جدول اليوم الأول (7 مايو):
• **09:00** — التسجيل والاستقبال — المدخل الرئيسي
• **10:00** — حفل الافتتاح — الصالة الرياضية
• **11:00** — بدء تطوير المشاريع — جميع القاعات
• **13:30** — استراحة الغداء — منطقة الطعام

EXAMPLE — "what is the WiFi password?":
📍 Guidance Agent:

• Network: **Siraj-Event**
• Password: **hackathon2025**`;

const STATIC = `
=== EVENT INFO ===
Name: Agenticthon — AI Agents Hackathon (هاكاثون الوكلاء الذكية)
Organizer: نادي الذكاء الاصطناعي – كلية هندسة وعلوم الحاسب | Partner: Beyond IT
Dates: 7–9 May 2026 (3 days)
Venue: Sports Hall – Prince Sattam bin Abdulaziz University, Al-Kharj
       الصالة الرياضية – جامعة الأمير سطام بن عبدالعزيز، الخرج
Team size: 2–5 members

=== 6 COMPETITION TRACKS ===
1. أتمتة العمليات (Process Automation) — وكلاء لأتمتة العمليات التجارية
2. التسويق الذكي (Smart Marketing) — وكلاء للتسويق والمبيعات
3. مراكز الاتصال الذكية (Intelligent Call Centers) — خدمة العملاء الصوتية
4. التعليم الذكي (Smart Education) — وكلاء للتعلم والتدريس
5. أنظمة متعددة الوكلاء (Multi-Agent Systems) — تعاون الوكلاء
6. تواصل وكيل إلى وكيل (Agent-to-Agent / A2A) — بروتوكولات A2A

=== SCHEDULE ===
Day 1 (7 May): 09:00 Registration | 10:00 Opening | 11:00 Hackathon Start | 13:30 Lunch | 15:00 Mentoring
Day 2 (8 May): 09:00 Development | 13:30 Lunch | 15:00 Mentoring
Day 3 (9 May): 09:00 Final Dev | 15:00 Presentations | 19:00 Awards Ceremony

=== VENUE & PARKING ===
P1 — North Entrance: 150 spots
P2 — South Entrance: 80 spots (backup)
Wi-Fi: Network: Siraj-Event | Password: ${process.env.WIFI_PASSWORD || 'hackathon2025'}

=== JUDGING ===
1. Team registration → 2. Initial screening → 3. 3-day sprint → 4. Final presentation`;

function buildContext() {
  const pct = state.stats.registered > 0
    ? Math.round((state.stats.checkedIn / state.stats.registered) * 100)
    : 0;
  return `\n=== LIVE STATS ===\nParking load: ~${pct}% (based on check-ins)\nActive alerts: ${state.stats.alertsActive}`;
}

async function handle(message) {
  logActivity('GuidanceAgent', 'يعالج سؤالاً', message.substring(0, 50));
  const answer = await askDeepSeek(SYSTEM + STATIC + buildContext(), message, { temperature: 0.5 });
  if (answer) logActivity('GuidanceAgent', 'أجاب', message.substring(0, 40));
  return answer;
}

// ── Personalized Lecture Recommendation ──────────────────────────

const RECOMMENDATION_SYSTEM = `You are the Guidance & Venue Agent for Agenticthon hackathon.
For THIS request you are answering a PERSONALIZED LECTURE RECOMMENDATION query.
Reply in the SAME language as the user. NEVER mix languages in one sentence.

OUTPUT FORMAT:
• Start with "📍 وكيل التوجيه:" on its own line
• Show 3-5 sessions sorted by relevance to the participant's skill and goal
• Each session: • **HH:MM** — Title — Hall | المحاضر: Name
• Max 10 lines. Bullet list only.

IDENTITY RESOLUTION RULES:
1. Search PARTICIPANTS LIST for a name matching any part of the user's message (partial match OK).
2. If found → use their skill, level, goal for personalization.
3. If not found but message contains a skill keyword (مطور، مصمم، AI، backend, frontend, etc.) → use that skill.
4. If identity completely unknown → respond ONLY: "ما اسمك أو تخصصك حتى أرشح لك المحاضرات المناسبة؟"

RELEVANCE SCORING:
• sessions whose relevantSkills contains the participant's skill = HIGH
• type="mentoring" sessions = always HIGH (benefits everyone)
• type="logistics" or type="break" = LOW (skip unless asked)
• Adjust by goal:
  - توظيف → prioritize type=presentation + type=mentoring
  - تعلم → prioritize type=mentoring + type=development
  - بناء مشروع → prioritize all type=development blocks

SPEAKER QUERIES ("من هو المحاضر X" / "who is speaker X"):
Search ENRICHED SCHEDULE for a speaker name matching X → return their speakerBio.
If not found in schedule → search MENTORS LIST by name → return their specialty.
If found in neither → say: "لا يوجد محاضر بهذا الاسم في سجلات الهاكاثون."`;

function buildRecommendationContext() {
  const scheduleText = state.schedule.map(item =>
    `[${item.type || 'event'}] ${item.time} — ${item.title} | قاعة: ${item.hall}` +
    (item.speaker ? ` | المحاضر: ${item.speaker} — ${item.speakerBio}` : '') +
    (item.relevantSkills && item.relevantSkills.length > 0
      ? ` | مناسب لـ: ${item.relevantSkills.join(', ')}`
      : ' | (عام للجميع)')
  ).join('\n');

  const participantsText = state.attendees.map(a =>
    `[PARTICIPANT] ${a.name} | التخصص: ${a.skill} | المستوى: ${a.level} | الهدف: ${a.goal}`
  ).join('\n');

  const mentorsText = state.mentors.map(m =>
    `[MENTOR] ${m.name} | التخصص: ${m.specialty}`
  ).join('\n');

  return `\n=== ENRICHED SCHEDULE ===\n${scheduleText}\n\n=== PARTICIPANTS LIST ===\n${participantsText}\n\n=== MENTORS LIST ===\n${mentorsText}`;
}

async function handleRecommendation(message) {
  logActivity('GuidanceAgent', 'يعالج طلب توصية محاضرات', message.substring(0, 50));
  const answer = await askDeepSeek(
    RECOMMENDATION_SYSTEM + buildRecommendationContext(),
    message,
    { temperature: 0.6 }
  );
  if (answer) logActivity('GuidanceAgent', 'أجاب بتوصية', message.substring(0, 40));
  return answer;
}

module.exports = { handle, handleRecommendation };
