const { askDeepSeek } = require('./deepseek');
const { state, logActivity } = require('../data/state');
const { checkParkingLoad, detectIssues } = require('./registrar');

function getHeatmap() {
  const entries = Object.entries(state.hallCounts).map(([hall, count]) => ({ hall, count }));
  entries.sort((a, b) => b.count - a.count);
  return { halls: entries, total: entries.reduce((s, e) => s + e.count, 0) };
}

async function generateSummary() {
  const pct = state.stats.registered > 0
    ? Math.round((state.stats.checkedIn / state.stats.registered) * 100)
    : 0;

  const parkingInfo = checkParkingLoad();
  const issues = detectIssues();
  const heatmap = getHeatmap();

  const context = `
=== LIVE EVENT STATS ===
المشاركون المسجلون: ${state.stats.registered}
المسجّلو الحضور: ${state.stats.checkedIn} (${pct}%)
الفرق المكونة: ${state.teams.length}
الأسئلة المجابة: ${state.stats.questionsAnswered}
التنبيهات النشطة: ${state.stats.alertsActive}

=== HALL OCCUPANCY ===
${heatmap.halls.map(h => `${h.hall}: ${h.count}`).join('\n') || 'لا بيانات'}

=== PARKING ===
${parkingInfo}

=== ACTIVE ISSUES ===
${issues.length > 0 ? issues.join('\n') : 'لا توجد مشكلات'}

=== ACTIVITY LOG (last 10) ===
${state.activityLog.slice(0, 10).map(e => `[${e.time}] ${e.agent}: ${e.action} — ${e.detail}`).join('\n')}`;

  const system = `You are an event operations analyst. Produce a concise Arabic executive summary (max 8 lines) of the current event status.
Highlight: attendance rate, any bottlenecks, team formation progress, and any urgent issues.
Start with "📊 ملخص العمليات:" on its own line.`;

  const summary = await askDeepSeek(system + context, 'اعطني ملخصاً تشغيلياً', { temperature: 0.4 });
  if (summary) logActivity('OperationsAgent', 'أنشأ ملخصاً', 'executive summary');
  return summary;
}

function getPopularSessions() {
  return state.schedule
    .filter(item => item.relevantSkills && item.relevantSkills.length > 0)
    .map(item => ({
      time: item.time,
      day: item.day,
      title: item.titleAr || item.title,
      skillCount: item.relevantSkills.length,
      type: item.type
    }))
    .sort((a, b) => b.skillCount - a.skillCount)
    .slice(0, 5);
}

module.exports = { getHeatmap, generateSummary, getPopularSessions };
