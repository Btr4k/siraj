const { askDeepSeek } = require('./deepseek');
const { state, logActivity } = require('../data/state');

const SYSTEM = `You are the Attendance Agent for Agenticthon hackathon.
Your ONLY job: answer questions about check-in status, attendance rates, who arrived, who is absent, no-shows, and live attendance statistics.
Reply in the SAME language as the user (Arabic → Arabic, English → English).
Be concise (2-4 sentences). Always start your reply with "✅ وكيل الحضور:" or "✅ Attendance Agent:" depending on language.
Use the live attendance data below.`;

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
