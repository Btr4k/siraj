const { askDeepSeek } = require('./deepseek');
const { state, logActivity } = require('../data/state');

const SYSTEM = `You are the Registration Agent for Agenticthon hackathon.
Your ONLY job: answer questions about attendee registration, participants list, skills, levels, and goals.
Reply in the SAME language as the user (Arabic → Arabic, English → English).
Be concise (2-4 sentences). Always start your reply with "🗂️ وكيل التسجيل:" or "🗂️ Registration Agent:" depending on language.
Use the live data below to answer precisely.

CRITICAL DISTINCTION — two completely separate groups in the data below:
• PARTICIPANTS (المشاركون): hackathon competitors. Their names have NO prefix.
• MENTORS (المرشدون): volunteer coaches. Their names are prefixed with "د." or "أ." and appear under the MENTORS section ONLY.
When asked "من هو/هي X":
  - Search the PARTICIPANTS list first. If found → identify as مشارك + their skill/level/team.
  - Search the MENTORS list. If found → identify as مرشد + their specialty.
  - If not found in either list → say clearly: "لا يوجد هذا الاسم في سجلات المنافسة."
NEVER invent or hallucinate any information about any person.`;

function buildContext() {
  const total = state.attendees.length;
  const checked = state.attendees.filter(a => a.checkedIn).length;
  const skills = [...new Set(state.attendees.map(a => a.skill))];
  const levels = { مبتدئ: 0, متوسط: 0, متقدم: 0 };
  state.attendees.forEach(a => { if (levels[a.level] !== undefined) levels[a.level]++; });

  return `
=== PARTICIPANTS / ATTENDEES (المشاركون — منافسون في الهاكاثون، ليسوا مرشدين) ===
Total registered: ${total} | Checked in: ${checked} | Not arrived: ${total - checked}
Skills: ${skills.join(', ')}
Levels: مبتدئ=${levels['مبتدئ']}, متوسط=${levels['متوسط']}, متقدم=${levels['متقدم']}

${state.attendees.map(a =>
  `[PARTICIPANT] ${a.name} | ${a.skill} | ${a.level} | ${a.checkedIn ? 'حاضر ✓' : 'غائب'} | فريق: ${a.team || 'غير محدد'}`
).join('\n')}

=== MENTORS (المرشدون — مختلفون تماماً عن المشاركين أعلاه، هم مدربون وخبراء) ===
${state.mentors.map(m =>
  `[MENTOR] ${m.name} | تخصص: ${m.specialty} | ${m.available ? 'متاح' : 'مشغول'}`
).join('\n')}`;
}

async function handle(message) {
  logActivity('RegistrationAgent', 'يعالج سؤالاً', message.substring(0, 50));
  const answer = await askDeepSeek(SYSTEM + buildContext(), message, { temperature: 0.4 });
  if (answer) logActivity('RegistrationAgent', 'أجاب', message.substring(0, 40));
  return answer;
}

module.exports = { handle };
