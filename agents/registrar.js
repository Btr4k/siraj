const { state, logActivity, addAlert } = require('../data/state');

function checkIn(attendeeId) {
  const att = state.attendees.find(a => a.id === parseInt(attendeeId));
  if (!att) return { success: false, message: 'Attendee not found / المشارك غير موجود' };
  if (att.checkedIn) return { success: false, message: `${att.name} already checked in / سبق تسجيل حضوره` };
  att.checkedIn = true;
  state.stats.checkedIn++;
  logActivity('Registrar', 'checked in', att.name);
  return { success: true, message: `✅ ${att.name} checked in successfully / تم تسجيل الحضور` };
}

function checkInAll() {
  let count = 0;
  state.attendees.forEach(a => {
    if (!a.checkedIn && Math.random() > 0.25) {
      a.checkedIn = true;
      state.stats.checkedIn++;
      count++;
    }
  });
  logActivity('Registrar', 'bulk check-in', `${count} attendees`);
  return { count, total: state.stats.registered };
}

function checkParkingLoad() {
  const pct = Math.round((state.stats.checkedIn / state.stats.registered) * 100);
  let msg, severity;
  if (pct >= 80) {
    msg = `⚠️ Parking P1 is ${pct}% full — use P2 / موقف P1 ممتلئ ${pct}% — استخدم P2`;
    severity = 'danger';
    addAlert(msg, severity);
  } else if (pct >= 60) {
    msg = `🟡 Parking P1 is ${pct}% full / موقف P1 ممتلئ ${pct}%`;
    severity = 'warning';
  } else {
    msg = `✅ Parking available — ${pct}% used / المواقف متاحة`;
    severity = 'ok';
  }
  logActivity('Operations', 'parking check', msg);
  return { pct, msg, severity };
}

function detectIssues() {
  const issues = [];
  const pct = Math.round((state.stats.checkedIn / state.stats.registered) * 100);
  if (pct > 75) issues.push(addAlert('Crowding at Hall B entrance / ازدحام في مدخل القاعة B', 'danger'));
  if (state.stats.questionsAnswered > 10) issues.push(addAlert('High question volume — publish FAQ / ارتفاع الأسئلة', 'warning'));
  logActivity('Operations', 'issue scan', `${issues.length} issues found`);
  return issues;
}

module.exports = { checkIn, checkInAll, checkParkingLoad, detectIssues };
