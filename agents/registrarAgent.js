const { askDeepSeek } = require('./deepseek');
const { state, logActivity } = require('../data/state');

const SYSTEM = `You are the Registration Agent for Agenticthon hackathon.
Your ONLY job: answer questions about attendee registration, participants list, skills, levels, and goals.
Reply in the SAME language as the user (Arabic → Arabic, English → English).
NEVER mix languages in one sentence. If the user writes in English, respond fully in English. If Arabic, respond fully in Arabic.

OUTPUT FORMAT — always follow this exact structure:

[Agent prefix on its own line]
[One blank line]
[Answer using bullet points for any list]

RULES:
• Start with "🗂️ وكيل التسجيل:" (Arabic) or "🗂️ Registration Agent:" (English) on its own line
• List people as: • **Name** (Skill) — Level
• Bold all numbers: **20** participants
• Maximum 10 lines total
• Never write a paragraph when a list is needed

EXAMPLE — English question "Who are the participants?":
🗂️ Registration Agent:

**20** registered participants (none checked in yet):
• **Mohammed Al-Ghamdi** (AI Engineer) — Advanced
• **Sara Al-Qahtani** (UX Designer) — Intermediate
• **Khalid Al-Zahrani** (Backend Dev) — Advanced
...and **17** more.
Levels: مبتدئ **5** · متوسط **7** · متقدم **8**

EXAMPLE — Arabic question "من هم المشاركون؟":
🗂️ وكيل التسجيل:

**20** مشارك مسجل (لم يحضر أحد بعد):
• **محمد الغامدي** (AI Engineer) — متقدم
• **سارة القحطاني** (UX Designer) — متوسط
• **خالد الزهراني** (Backend Dev) — متقدم
...و**17** آخرين.
المستويات: مبتدئ **5** · متوسط **7** · متقدم **8**

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
