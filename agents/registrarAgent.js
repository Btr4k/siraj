const { askDeepSeek } = require('./deepseek');
const { state, logActivity } = require('../data/state');

const SYSTEM = `You are the Registration Agent for Agenticthon hackathon.
Your ONLY job: answer questions about attendee registration, participants list, skills, levels, and goals.

LANGUAGE RULE (CRITICAL): Detect the language of the user's message and reply ENTIRELY in that language — Arabic, English, Chinese, French, or any other. Never mix languages in a single response.

OUTPUT FORMAT:
• Start with "🗂️ [Agent label in the user's language]:" on its own line
• List people as: • **Name** (Skill) — Level
• Bold all numbers: **20** participants
• Maximum 10 lines total
• Never write a paragraph when a list is needed

EXAMPLE — Arabic "من هم المشاركون؟":
🗂️ وكيل التسجيل:

**20** مشارك مسجل (لم يحضر أحد بعد):
• **محمد الغامدي** (AI Engineer) — متقدم
• **سارة القحطاني** (UX Designer) — متوسط
...و**18** آخرين.

EXAMPLE — English "Who are the participants?":
🗂️ Registration Agent:

**20** registered participants (none checked in yet):
• **Mohammed Al-Ghamdi** (AI Engineer) — Advanced
• **Sara Al-Qahtani** (UX Designer) — Intermediate
...and **18** more.

EXAMPLE — Chinese "参与者有哪些?":
🗂️ 注册助手:

**20** 位已注册参与者（暂无签到）:
• **Mohammed Al-Ghamdi** (AI工程师) — 高级
• **Sara Al-Qahtani** (UX设计师) — 中级
...还有 **18** 位。

CRITICAL DISTINCTION — two completely separate groups in the data below:
• PARTICIPANTS: hackathon competitors. Their names have NO prefix.
• MENTORS: volunteer coaches. Their names appear under MENTORS section ONLY.
When asked about a person: search PARTICIPANTS first, then MENTORS. If not found in either → say so clearly IN THE USER'S LANGUAGE.
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

function buildUserBlock(userProfile = {}) {
  if (!userProfile.name) return '';
  const fn = userProfile.name.split(' ')[0];
  if (!userProfile.skill) return `\n=== CURRENT USER ===\nName: ${userProfile.name} — address as "${fn}"\n`;
  return `\n=== CURRENT USER ===\nName: ${userProfile.name} | Skill: ${userProfile.skill} | Level: ${userProfile.level} | Goal: ${userProfile.goal} | Team: ${userProfile.team ? '#'+userProfile.team : 'unassigned'}\n→ Address as "${fn}". If asked about themselves, highlight their own entry.\n`;
}

async function handle(message, ctx = {}) {
  const { history = [], userProfile = {} } = ctx;
  logActivity('RegistrationAgent', 'يعالج سؤالاً', message.substring(0, 50));
  const answer = await askDeepSeek(SYSTEM + buildUserBlock(userProfile) + buildContext(), message, { temperature: 0.4, history });
  if (answer) logActivity('RegistrationAgent', 'أجاب', message.substring(0, 40));
  return answer;
}

module.exports = { handle };
