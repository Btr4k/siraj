const { askDeepSeek } = require('./deepseek');
const {
  state, logActivity,
  addAttendee, updateAttendee, checkinAttendee, checkoutAttendee, deleteAttendee,
  addMentor, updateMentor,
  addScheduleItem
} = require('../data/state');

const SYSTEM_PROMPT = `You are the Siraj DataManager — the data administration agent for Agenticthon hackathon.
Your ONLY job is to parse admin commands and return a strict JSON object.
You NEVER explain, greet, or add any text outside the JSON.
You ALWAYS respond with a single valid JSON object, nothing else.

Supported actions and their schemas:

ADD_ATTENDEE    → { "action": "ADD_ATTENDEE",    "data": { "name": string, "skill": string, "level": "مبتدئ"|"متوسط"|"متقدم", "goal": "تعلم"|"توظيف"|"بناء مشروع" } }
UPDATE_ATTENDEE → { "action": "UPDATE_ATTENDEE", "data": { "identifier": string, "fields": { ...changed fields only... } } }
CHECKIN_ATTENDEE  → { "action": "CHECKIN_ATTENDEE",  "data": { "identifier": string } }
CHECKOUT_ATTENDEE → { "action": "CHECKOUT_ATTENDEE", "data": { "identifier": string } }
DELETE_ATTENDEE   → { "action": "DELETE_ATTENDEE",   "data": { "identifier": string } }
ADD_MENTOR      → { "action": "ADD_MENTOR",      "data": { "name": string, "specialty": string, "available": boolean } }
UPDATE_MENTOR   → { "action": "UPDATE_MENTOR",   "data": { "identifier": string, "fields": { ...changed fields only... } } }
ADD_SCHEDULE_ITEM → { "action": "ADD_SCHEDULE_ITEM", "data": { "time": "HH:MM", "title": string, "hall": string, "duration": number } }
BULK_CHECKIN    → { "action": "BULK_CHECKIN",    "data": { "filter": "all" } }
UNKNOWN         → { "action": "UNKNOWN",         "data": { "reason": string } }

Field defaults:
- level: "متوسط"
- goal: "تعلم"
- available: true
- duration: 60

Skill examples (accept any): AI Engineer, Backend Dev, Frontend Dev, Data Scientist, UX Designer, Product Manager, DevOps, Business Dev

EXAMPLES:
"أضف مشارك اسمه أحمد تخصصه Frontend Dev"
→ {"action":"ADD_ATTENDEE","data":{"name":"أحمد","skill":"Frontend Dev","level":"متوسط","goal":"تعلم"}}

"سجل حضور سارة"
→ {"action":"CHECKIN_ATTENDEE","data":{"identifier":"سارة"}}

"Add mentor Dr. Smith specialty Cloud Architecture"
→ {"action":"ADD_MENTOR","data":{"name":"Dr. Smith","specialty":"Cloud Architecture","available":true}}

"حدّث مستوى خالد إلى متقدم"
→ {"action":"UPDATE_ATTENDEE","data":{"identifier":"خالد","fields":{"level":"متقدم"}}}

"سجل حضور الجميع"
→ {"action":"BULK_CHECKIN","data":{"filter":"all"}}

"احذف المشارك رقم 5"
→ {"action":"DELETE_ATTENDEE","data":{"identifier":"5"}}`;

async function processCommand(rawCommand) {
  const raw = await askDeepSeek(SYSTEM_PROMPT, rawCommand, { temperature: 0.1, max_tokens: 300 });

  if (!raw) return { success: false, error: 'لم يستجب الوكيل — حاول مجدداً' };

  let parsed;
  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch (e) {
    return { success: false, error: 'الوكيل أعاد بيانات غير صالحة', raw };
  }

  return executeAction(parsed, rawCommand);
}

function executeAction({ action, data }, originalCommand) {
  logActivity('DataManager', action, originalCommand.substring(0, 60));

  switch (action) {
    case 'ADD_ATTENDEE':      return addAttendee(data);
    case 'UPDATE_ATTENDEE':   return updateAttendee(data.identifier, data.fields || {});
    case 'CHECKIN_ATTENDEE':  return checkinAttendee(data.identifier);
    case 'CHECKOUT_ATTENDEE': return checkoutAttendee(data.identifier);
    case 'DELETE_ATTENDEE':   return deleteAttendee(data.identifier);
    case 'ADD_MENTOR':        return addMentor(data);
    case 'UPDATE_MENTOR':     return updateMentor(data.identifier, data.fields || {});
    case 'ADD_SCHEDULE_ITEM': return addScheduleItem(data);
    case 'BULK_CHECKIN': {
      let count = 0;
      state.attendees.forEach(a => {
        if (!a.checkedIn) { a.checkedIn = true; state.stats.checkedIn++; count++; }
      });
      logActivity('DataManager', 'bulk check-in', `${count} مشارك`);
      return { success: true, count, message: `تم تسجيل حضور ${count} مشارك` };
    }
    case 'UNKNOWN':
      return { success: false, error: data.reason || 'أمر غير مفهوم' };
    default:
      return { success: false, error: `إجراء غير معروف: ${action}` };
  }
}

module.exports = { processCommand };
