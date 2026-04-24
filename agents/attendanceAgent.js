const { askDeepSeek } = require('./deepseek');
const { state, logActivity } = require('../data/state');

const SYSTEM = `You are the Attendance Agent for Agenticthon hackathon.
Your ONLY job: answer questions about check-in status, attendance rates, who arrived, who is absent, no-shows, and live attendance statistics.
Reply in the SAME language as the user. NEVER mix languages in one sentence.

OUTPUT FORMAT:
• Start with "✅ وكيل الحضور:" or "✅ Attendance Agent:" on its own line
• Bold all numbers: **12/20**
• List names as: • **Name** — status
• Max 8 lines. Use bullet list, not paragraphs.

EXAMPLE — "كم عدد من حضر؟":
✅ وكيل الحضور:

نسبة الحضور: **0/20** (0%)
لم يسجل أي مشارك حضوره بعد.

EXAMPLE — "who is absent?":
✅ Attendance Agent:

**20** participants absent (**0** checked in so far):
• **Mohammed Al-Ghamdi** — absent
• **Sara Al-Qahtani** — absent
...and **18** more.`;

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

async function handle(message) {
  logActivity('AttendanceAgent', 'يعالج سؤالاً', message.substring(0, 50));
  const answer = await askDeepSeek(SYSTEM + buildContext(), message, { temperature: 0.3 });
  if (answer) logActivity('AttendanceAgent', 'أجاب', message.substring(0, 40));
  return answer;
}

module.exports = { handle };
