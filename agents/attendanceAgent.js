const { askDeepSeek } = require('./deepseek');
const { state, logActivity } = require('../data/state');

const SYSTEM = `You are the Attendance Agent for Agenticthon hackathon.
Your ONLY job: answer questions about check-in status, attendance rates, who arrived, who is absent, no-shows, and live attendance statistics.

LANGUAGE RULE (CRITICAL): Detect the language of the user's message and reply ENTIRELY in that language — Arabic, English, Chinese, French, or any other. Never mix languages.

OUTPUT FORMAT:
• Start with "✅ [Agent label in the user's language]:" on its own line
• Bold all numbers: **12/20**
• List names as: • **Name** — [status in user's language]
• Max 8 lines. Use bullet list, not paragraphs.

EXAMPLE — Arabic:
✅ وكيل الحضور:
نسبة الحضور: **0/20** (0%)

EXAMPLE — English:
✅ Attendance Agent:
Attendance: **0/20** (0%) — no one checked in yet.

EXAMPLE — Chinese:
✅ 出勤助手:
出勤率: **0/20** (0%) — 暂无签到记录。`;

function buildContext() {
  const total = state.attendees.length;
  const present = state.attendees.filter(a => a.checkedIn);
  const absent  = state.attendees.filter(a => !a.checkedIn);
  const pct     = total > 0 ? Math.round((present.length / total) * 100) : 0;

  return `
=== LIVE ATTENDANCE STATUS ===
Total registered: ${total}
Present now: ${present.length} (${pct}%)
Not arrived: ${absent.length}

=== PRESENT ATTENDEES ===
${present.length > 0 ? present.map(a => `✓ ${a.name} (${a.skill})`).join('\n') : '- None yet'}

=== ABSENT / NOT ARRIVED ===
${absent.length > 0 ? absent.map(a => `✗ ${a.name} (${a.skill})`).join('\n') : '- All attendees have arrived'}

=== ALERTS ===
${state.alerts.length > 0 ? state.alerts.map(a => `⚠️ ${a.message}`).join('\n') : '- No active alerts'}`;
}

function buildUserBlock(userProfile = {}) {
  if (!userProfile.name) return '';
  const fn = userProfile.name.split(' ')[0];
  const self = userProfile.attendeeId
    ? state.attendees.find(a => a.id === userProfile.attendeeId)
    : null;
  const selfStatus = self ? (self.checkedIn ? 'حاضر ✓' : 'لم يسجل حضوره بعد') : null;
  return `\n=== CURRENT USER ===\nName: ${userProfile.name} — address as "${fn}"${selfStatus ? ` | Status: ${selfStatus}` : ''}\n`;
}

async function handle(message, ctx = {}) {
  const { history = [], userProfile = {} } = ctx;
  logActivity('AttendanceAgent', 'يعالج سؤالاً', message.substring(0, 50));
  const answer = await askDeepSeek(SYSTEM + buildUserBlock(userProfile) + buildContext(), message, { temperature: 0.3, history });
  if (answer) logActivity('AttendanceAgent', 'أجاب', message.substring(0, 40));
  return answer;
}

module.exports = { handle };
