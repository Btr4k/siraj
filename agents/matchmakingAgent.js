const { askDeepSeek } = require('./deepseek');
const { state, logActivity } = require('../data/state');

const SYSTEM = `You are the Matchmaking Agent for Agenticthon hackathon.
Your ONLY job: answer questions about teams, team composition, mentor assignments, who is on which team, and matching status.
Reply in the SAME language as the user. NEVER mix languages in one sentence.

OUTPUT FORMAT:
• Start with "🤝 وكيل التطابق:" or "🤝 Matchmaking Agent:" on its own line
• List mentors as: • **Name** — Specialty — ✅ متاح / 🔴 مشغول
• List team members as: • **Name** (Skill)
• Max 8 lines. Bullet list only, no paragraphs.

EXAMPLE — "من هم المرشدون المتاحون؟":
🤝 وكيل التطابق:

المرشدون المتاحون (**3** من **5**):
• **د. أحمد الفارسي** — NLP & Machine Learning — ✅ متاح
• **أ. نورة السبيعي** — Product & UX — ✅ متاح
• **د. سارة العمري** — Business & Startups — ✅ متاح

EXAMPLE — "who are the available mentors?":
🤝 Matchmaking Agent:

Available mentors (**3** of **5**):
• **Dr. Ahmed Al-Farsi** — NLP & Machine Learning — ✅ Available
• **A. Noura Al-Subai'i** — Product & UX — ✅ Available
• **Dr. Sara Al-Omari** — Business & Startups — ✅ Available

CRITICAL DISTINCTION — two completely separate groups:
• PARTICIPANTS/ATTENDEES (المشاركون): the hackathon competitors assigned to teams. They appear under FORMED TEAMS and UNASSIGNED ATTENDEES.
• MENTORS (المرشدون): volunteer coaches who guide teams. They appear under MENTORS section only.
Never confuse these two groups. A mentor is NEVER a participant, and a participant is NEVER a mentor.`;

function buildContext() {
  const unassigned = state.attendees.filter(a => !a.team);
  const availableMentors = state.mentors.filter(m => m.available);

  const teamsText = state.teams.length > 0
    ? state.teams.map(tm => {
        const names = tm.members.map(id => {
          const a = state.attendees.find(x => x.id === id);
          return a ? `${a.name} (${a.skill})` : `#${id}`;
        }).join(', ');
        return `- Team #${tm.team}: ${names}${tm.reason ? ` | Reason: ${tm.reason}` : ''}`;
      }).join('\n')
    : '- No teams formed yet';

  return `
=== TEAMS STATUS ===
Total teams: ${state.teams.length}
Unassigned PARTICIPANTS (not mentors): ${unassigned.length}
${unassigned.length > 0 ? unassigned.map(a => `  - [PARTICIPANT] ${a.name} | ${a.skill} | ${a.level}`).join('\n') : '  - All assigned'}

=== FORMED TEAMS (members are all PARTICIPANTS, not mentors) ===
${teamsText}

=== MENTORS (مرشدون — completely separate from participants) ===
Available mentors: ${availableMentors.length}
${availableMentors.map(m => `✓ [MENTOR] ${m.name} — ${m.specialty}`).join('\n') || '- None available'}
Busy mentors: ${state.mentors.filter(m => !m.available).map(m => `✗ [MENTOR] ${m.name}`).join(', ') || 'None'}`;
}

async function handle(message) {
  logActivity('MatchmakingAgent', 'يعالج سؤالاً', message.substring(0, 50));
  const answer = await askDeepSeek(SYSTEM + buildContext(), message, { temperature: 0.4 });
  if (answer) logActivity('MatchmakingAgent', 'أجاب', message.substring(0, 40));
  return answer;
}

module.exports = { handle };
