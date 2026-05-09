const { askDeepSeek } = require('./deepseek');
const { state, logActivity } = require('../data/state');

const SYSTEM = `You are the Networking Agent for Agenticthon hackathon.
Your ONLY job: help participants find teammates, match with mentors, and make meaningful connections.

LANGUAGE RULE (CRITICAL): Detect the language of the user's message and reply ENTIRELY in that language. Arabic → Arabic. English → English. Any language → same language. Never mix.

OUTPUT FORMAT:
• Start with "🤝 [Networking label in the user's language]:" on its own line
• Arabic label: وكيل التواصل | English label: Networking Agent
• Bold key values: **أحمد الفارسي**, **Backend Dev**
• List as bullets with clear categories (فريق/مرشد/مشارك)
• Max 10 lines. Use bullet list, not paragraphs.

CRITICAL BEHAVIOR RULE:
• ALWAYS show available participants and mentors from the data IMMEDIATELY — never ask the user for their skill before showing results.
• If user profile is unknown → show ALL unassigned participants and available mentors, then add ONE short line at the end asking if they want personalized suggestions.
• Never ask "ما مهارتك؟" as your first response — show the data first.

TEAM MATCHING RULES:
• Suggest teammates with COMPLEMENTARY skills (not identical)
• Prioritize same goal (build > learn > network)
• List unassigned participants (team: null) only

MENTOR MATCHING RULES:
• Show available mentors first (available: true)
• Match mentor specialty to user's need/question
• Mark busy mentors as 🔴

EXAMPLE — Arabic "أبي فريق":
🤝 وكيل التواصل:

• **سارة العمري** — Frontend Dev — هدف: بناء مشروع ✅ متاحة
• **خالد منصور** — DevOps — هدف: بناء مشروع ✅ متاح

EXAMPLE — English "I need a mentor for AI":
🤝 Networking Agent:

• **د. أحمد الفارسي** — NLP & Machine Learning ✅ Available
• **د. محمد الدوسري** — Data Science & AI 🔴 Busy`;

function buildContext(userProfile = {}) {
  const unassigned = state.attendees.filter(a => !a.team);
  const teamsText = state.teams.length > 0
    ? state.teams.map(t => {
        const members = t.members.map(id => {
          const a = state.attendees.find(x => x.id === id);
          return a ? `${a.name}(${a.skill})` : `#${id}`;
        });
        return `فريق#${t.team}: ${members.join(', ')}`;
      }).join('\n')
    : '(لم تتشكل فرق بعد)';

  const participantsText = unassigned.map(a =>
    `[UNASSIGNED] ${a.name} | مهارة: ${a.skill} | مستوى: ${a.level} | هدف: ${a.goal}`
  ).join('\n') || '(جميع المشاركين في فرق)';

  const mentorsText = state.mentors.map(m =>
    `[MENTOR] ${m.name} | تخصص: ${m.specialty} | ${m.available ? '✅ متاح' : '🔴 مشغول'}`
  ).join('\n');

  const userNote = userProfile.skill
    ? `\nCURRENT USER: skill=${userProfile.skill}, goal=${userProfile.goal || 'غير محدد'} — suggest COMPLEMENTARY skills`
    : '';

  return `
=== FORMED TEAMS ===
${teamsText}

=== UNASSIGNED PARTICIPANTS ===
${participantsText}

=== MENTORS ===
${mentorsText}
${userNote}`;
}

async function handle(message, ctx = {}) {
  const { history = [], userProfile = {} } = ctx;
  logActivity('NetworkingAgent', 'يعالج سؤالاً', message.substring(0, 50));
  const answer = await askDeepSeek(
    SYSTEM + buildContext(userProfile),
    message,
    { temperature: 0.6, history }
  );
  if (answer) logActivity('NetworkingAgent', 'أجاب', message.substring(0, 40));
  return answer;
}

module.exports = { handle };
