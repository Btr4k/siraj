const attendees = require('./attendees');
const { mentors, schedule, venue } = require('./schedule');

const state = {
  attendees: JSON.parse(JSON.stringify(attendees)),
  mentors:   JSON.parse(JSON.stringify(mentors)),
  schedule:  JSON.parse(JSON.stringify(schedule)),
  venue,
  teams: [],
  activityLog: [],
  alerts: [],
  telegramUsers: [], // { telegramId, name? } — collected from webhook
  stats: {
    registered: 20,
    checkedIn: 0,
    teamsFormed: 0,
    questionsAnswered: 0,
    alertsActive: 0
  }
};

// ── Core ────────────────────────────────────────────────────

function logActivity(agent, action, detail) {
  const entry = {
    id: Date.now(),
    time: new Date().toLocaleTimeString('ar-SA'),
    agent, action, detail
  };
  state.activityLog.unshift(entry);
  if (state.activityLog.length > 50) state.activityLog.pop();
  return entry;
}

function addAlert(message, severity = 'warning') {
  const alert = { id: Date.now(), message, severity, time: new Date().toLocaleTimeString('ar-SA') };
  state.alerts.unshift(alert);
  state.stats.alertsActive = state.alerts.length;
  return alert;
}

function resolveAlert(id) {
  state.alerts = state.alerts.filter(a => a.id !== id);
  state.stats.alertsActive = state.alerts.length;
}

// ── Internal finders ────────────────────────────────────────

function findAttendee(identifier) {
  const asNum = parseInt(identifier);
  if (!isNaN(asNum)) return state.attendees.find(a => a.id === asNum);
  return state.attendees.find(a => a.name === identifier)
      || state.attendees.find(a => a.name.includes(identifier));
}

function findMentor(identifier) {
  const asNum = parseInt(identifier);
  if (!isNaN(asNum)) return state.mentors.find(m => m.id === asNum);
  return state.mentors.find(m => m.name === identifier)
      || state.mentors.find(m => m.name.includes(identifier));
}

// ── Attendee mutations ──────────────────────────────────────

function addAttendee({ name, skill, level = 'متوسط', goal = 'تعلم' }) {
  if (!name || !skill) return { success: false, error: 'name and skill are required' };
  const id = state.attendees.length > 0 ? Math.max(...state.attendees.map(a => a.id)) + 1 : 1;
  const att = { id, name, skill, level, goal, team: null, checkedIn: false };
  state.attendees.push(att);
  state.stats.registered = state.attendees.length;
  logActivity('DataManager', 'أضاف مشاركاً', `${name} — ${skill}`);
  return { success: true, attendee: att };
}

function updateAttendee(identifier, fields) {
  const att = findAttendee(identifier);
  if (!att) return { success: false, error: `لم يُعثر على المشارك: ${identifier}` };
  const allowed = ['name', 'skill', 'level', 'goal', 'team'];
  allowed.forEach(k => { if (fields[k] !== undefined) att[k] = fields[k]; });
  logActivity('DataManager', 'حدّث مشاركاً', att.name);
  return { success: true, attendee: att };
}

function checkinAttendee(identifier) {
  const att = findAttendee(identifier);
  if (!att) return { success: false, error: `لم يُعثر على المشارك: ${identifier}` };
  if (att.checkedIn) return { success: false, error: `${att.name} سبق تسجيل حضوره` };
  att.checkedIn = true;
  state.stats.checkedIn++;
  logActivity('DataManager', 'سجّل حضور', att.name);
  return { success: true, attendee: att };
}

function checkoutAttendee(identifier) {
  const att = findAttendee(identifier);
  if (!att) return { success: false, error: `لم يُعثر على المشارك: ${identifier}` };
  if (!att.checkedIn) return { success: false, error: `${att.name} لم يسجّل حضوره أصلاً` };
  att.checkedIn = false;
  state.stats.checkedIn = Math.max(0, state.stats.checkedIn - 1);
  logActivity('DataManager', 'ألغى حضور', att.name);
  return { success: true, attendee: att };
}

function deleteAttendee(identifier) {
  const att = findAttendee(identifier);
  if (!att) return { success: false, error: `لم يُعثر على المشارك: ${identifier}` };
  state.attendees = state.attendees.filter(a => a.id !== att.id);
  state.stats.registered = state.attendees.length;
  if (att.checkedIn) state.stats.checkedIn = Math.max(0, state.stats.checkedIn - 1);
  logActivity('DataManager', 'حذف مشاركاً', att.name);
  return { success: true, deleted: att.name };
}

// ── Mentor mutations ─────────────────────────────────────────

function addMentor({ name, specialty, available = true }) {
  if (!name || !specialty) return { success: false, error: 'name and specialty are required' };
  const id = state.mentors.length > 0 ? Math.max(...state.mentors.map(m => m.id)) + 1 : 1;
  const mentor = { id, name, specialty, available, team: null };
  state.mentors.push(mentor);
  logActivity('DataManager', 'أضاف مرشداً', `${name} — ${specialty}`);
  return { success: true, mentor };
}

function updateMentor(identifier, fields) {
  const mentor = findMentor(identifier);
  if (!mentor) return { success: false, error: `لم يُعثر على المرشد: ${identifier}` };
  const allowed = ['name', 'specialty', 'available', 'team'];
  allowed.forEach(k => { if (fields[k] !== undefined) mentor[k] = fields[k]; });
  logActivity('DataManager', 'حدّث مرشداً', mentor.name);
  return { success: true, mentor };
}

// ── Schedule mutations ───────────────────────────────────────

function addScheduleItem({ time, title, hall, duration }) {
  if (!time || !title) return { success: false, error: 'time and title are required' };
  const item = { time, title, hall: hall || 'غير محدد', duration: duration || 60 };
  state.schedule.push(item);
  state.schedule.sort((a, b) => a.time.localeCompare(b.time));
  logActivity('DataManager', 'أضاف جدولاً', `${time} — ${title}`);
  return { success: true, item };
}

// ── Telegram users ───────────────────────────────────────────

function registerTelegramUser(telegramId, name) {
  if (!state.telegramUsers.find(u => u.telegramId === telegramId)) {
    state.telegramUsers.push({ telegramId, name: name || 'مشارك' });
  }
}

module.exports = {
  state,
  logActivity, addAlert, resolveAlert,
  addAttendee, updateAttendee, checkinAttendee, checkoutAttendee, deleteAttendee,
  addMentor, updateMentor,
  addScheduleItem,
  registerTelegramUser,
  findAttendee, findMentor
};
