const { askDeepSeek } = require('./deepseek');
const { state, logActivity } = require('../data/state');

async function formTeams() {
  const unassigned = state.attendees.filter(a => !a.team);
  if (unassigned.length < 2) return { success: false, message: 'لا يوجد مشاركون كافون' };

  const list = unassigned.map(a => `${a.id}. ${a.name} | ${a.skill} | ${a.level} | ${a.goal}`).join('\n');

  const prompt = `لديك هؤلاء المشاركون:\n${list}\n\nكوّن فرقاً متوازنة من 3-4 أشخاص بمهارات متنوعة.\nأجب بـ JSON فقط:\n[{"team":1,"members":[1,2,3],"reason":"سبب"}]`;

  const result = await askDeepSeek('أنت خبير تكوين فرق هاكاثون. أجب بـ JSON فقط بدون أي نص إضافي.', prompt);

  try {
    const teams = JSON.parse(result.replace(/```json|```/g, '').trim());
    // Clear previous teams before rebuilding
    state.teams = [];
    state.attendees.forEach(a => { a.team = null; });
    teams.forEach(t => {
      t.members.forEach(id => {
        const att = state.attendees.find(a => a.id === id);
        if (att) att.team = t.team;
      });
      state.teams.push(t);
    });
    state.stats.teamsFormed = state.teams.length;
    logActivity('Matchmaker', `كوّن ${teams.length} فرق`, `${unassigned.length} مشارك`);
    return { success: true, teams, count: teams.length };
  } catch (e) {
    return { success: false, message: 'خطأ في معالجة النتائج' };
  }
}

async function matchMentor(teamId, need) {
  const available = state.mentors.filter(m => m.available);
  if (!available.length) return { success: false, message: 'جميع المنتورين مشغولون' };

  const list = available.map(m => `${m.id}. ${m.name} - ${m.specialty}`).join('\n');
  const result = await askDeepSeek('أنت منسق منتورين.', `فريق #${teamId} يحتاج: ${need}\nالمتاحون:\n${list}\nمن الأنسب؟ جملتان فقط.`);

  const mentor = available[0];
  mentor.available = false;
  mentor.team = teamId;
  logActivity('Matchmaker', 'طابق منتور', `الفريق #${teamId} ← ${mentor.name}`);
  return { success: true, mentor, suggestion: result };
}

module.exports = { formTeams, matchMentor };
