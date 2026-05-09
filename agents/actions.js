const { state, checkinAttendee, addAlert, updateAttendee, logActivity } = require('../data/state');
const { getOrCreateProfile } = require('../data/profiles');

// ── Intent patterns ────────────────────────────────────────────
// Support: "سجل حضوري" alone, or "سجل حضوري عبدالله العتيبي" with inline name
const CHECKIN_PATTERN      = /^(?:سجل حضوري|سجلني|تسجيل حضوري|check me in|check-in me)/i;
const CHECKIN_WITH_NAME    = /(?:سجل حضوري|سجلني|تسجيل حضوري|check me in|check-in me)\s+(.{3,50})/i;
const MENTOR_PATTERN       = /أبي مرشد|احتاج مرشد|أريد مرشد|طلب مرشد|أحتاج مرشد|need.*mentor|request.*mentor|get.*mentor/i;
const TEAM_PATTERN         = /(?:أنضم|أضفني|انضم|join)\s+(?:إلى\s+)?(?:الفريق|لفريق|فريق|team)\s*#?(\d+)/i;

// ── Strict full-name match ─────────────────────────────────────
// Requires BOTH first name AND at least one other word to match
// Prevents matching "عبدالله غالب" → "عبدالله العتيبي"
function strictNameMatch(input, attendeeName) {
  const inputParts    = input.trim().split(/\s+/).filter(w => w.length > 1);
  const attendeeParts = attendeeName.trim().split(/\s+/).filter(w => w.length > 1);
  if (inputParts.length < 2) return false; // single word → reject (too ambiguous)
  const matchCount = inputParts.filter(w =>
    attendeeParts.some(ap => ap === w || ap.startsWith(w) || w.startsWith(ap))
  ).length;
  return matchCount >= 2; // at least 2 words must match
}

// ── User identity resolution ───────────────────────────────────
// Only returns a match via reliable links OR strict full-name
// NEVER matches on first name alone
function resolveUser(chatId, sessProfile, explicitName = null) {
  // 1. Direct telegramChatId link (set during onboarding — most reliable)
  const byChat = state.attendees.find(a => a.telegramChatId === String(chatId));
  if (byChat) return { att: byChat, confident: true };

  // 2. Profile attendeeId (set during onboarding fast-track)
  const profile = getOrCreateProfile(String(chatId));
  if (profile.attendeeId) {
    const byProfileId = state.attendees.find(a => a.id === profile.attendeeId);
    if (byProfileId) return { att: byProfileId, confident: true };
  }

  // 3. Session userProfile attendeeId
  if (sessProfile?.attendeeId) {
    const bySess = state.attendees.find(a => a.id === sessProfile.attendeeId);
    if (bySess) return { att: bySess, confident: true };
  }

  // 4. Explicit inline name (from message like "سجل حضوري عبدالله العتيبي")
  //    Requires strict full-name match (≥2 words)
  if (explicitName) {
    const matches = state.attendees.filter(a => strictNameMatch(explicitName, a.name));
    if (matches.length === 1) return { att: matches[0], confident: true };
    if (matches.length > 1)   return { att: null, confident: false, ambiguous: matches };
  }

  return { att: null, confident: false };
}

// ── Main action handler ────────────────────────────────────────
// Returns { ok, msg } if message is an action intent, null otherwise
async function tryAction(message, chatId, sessProfile) {

  // ── تسجيل الحضور ───────────────────────────────────────────
  if (CHECKIN_PATTERN.test(message)) {
    // Extract inline name if provided: "سجل حضوري عبدالله العتيبي"
    const inlineMatch = message.match(CHECKIN_WITH_NAME);
    const inlineName  = inlineMatch ? inlineMatch[1].trim() : null;

    const { att, confident, ambiguous } = resolveUser(chatId, sessProfile, inlineName);

    // Ambiguous: multiple attendees matched the inline name
    if (ambiguous) {
      const names = ambiguous.map(a => `• ${a.name}`).join('\n');
      return {
        ok: false,
        msg: `⚠️ *وجدت أكثر من شخص بهذا الاسم:*\n${names}\n\nأرسل اسمك الكامل الرباعي أو تواصل مع المنظمين.`
      };
    }

    // Not found via any reliable method
    if (!att) {
      return {
        ok: false,
        msg: '⚠️ *ما وجدت اسمك في قائمة المشاركين*\n\n' +
             'أرسل اسمك الكامل بعد الأمر مثل:\n' +
             '`سجل حضوري عبدالله العتيبي`\n\n' +
             'تأكد أن الاسم مطابق تماماً لما هو مسجل، أو تواصل مع المنظمين.'
      };
    }

    const result = checkinAttendee(att.id);
    if (!result.success) {
      return { ok: false, msg: `⚠️ ${result.error}` };
    }
    logActivity('Actions', 'تسجيل حضور ذاتي', att.name);
    return {
      ok: true,
      msg: `✅ *تم تسجيل حضورك يا ${att.name.split(' ')[0]}!*\n\nأهلاً وسهلاً في Agenticthon 🎉\nالمكان: الصالة الرياضية – جامعة الأمير سطام`
    };
  }

  // ── طلب مرشد ───────────────────────────────────────────────
  if (MENTOR_PATTERN.test(message)) {
    const { att }  = resolveUser(chatId, sessProfile);
    const userName = att?.name || getOrCreateProfile(String(chatId)).name || sessProfile?.name || 'مشارك';
    const firstName = userName.split(' ')[0];

    const available = state.mentors.filter(m => m.available);

    if (available.length === 0) {
      addAlert(`🙋 طلب مرشد: ${userName} — جميع المرشدين مشغولون`, 'warning');
      logActivity('Actions', 'طلب مرشد (لا يوجد متاح)', userName);
      return {
        ok: true,
        msg: `⏳ *جميع المرشدين مشغولون حالياً يا ${firstName}*\n\nتم تسجيل طلبك ✅ — سيتواصل معك المنظمون فور توفّر مرشد 🔔`
      };
    }

    // Pick mentor with matching specialty if known
    const userSkill = att?.skill || sessProfile?.skill || getOrCreateProfile(String(chatId)).interests?.[0];
    const mentor = userSkill
      ? (available.find(m => m.specialty.toLowerCase().includes(userSkill.toLowerCase())) || available[0])
      : available[0];

    addAlert(`🙋 طلب مرشد: ${userName} → ${mentor.name}`, 'info');
    logActivity('Actions', 'طلب مرشد', `${userName} → ${mentor.name}`);

    return {
      ok: true,
      msg: `✅ *تم إرسال طلبك يا ${firstName}!*\n\n` +
           `👨‍🏫 *المرشد المقترح:* ${mentor.name}\n` +
           `🎯 *التخصص:* ${mentor.specialty}\n\n` +
           `_سيتواصل معك المنظمون خلال دقائق_ 🔔`
    };
  }

  // ── الانضمام لفريق ─────────────────────────────────────────
  const teamMatch = message.match(TEAM_PATTERN);
  if (teamMatch) {
    const { att } = resolveUser(chatId, sessProfile);
    if (!att) {
      return {
        ok: false,
        msg: '⚠️ *ما قدرت أتعرف عليك*\n\nأرسل /start لتسجيل ملفك أولاً.'
      };
    }
    if (att.team) {
      return { ok: false, msg: `⚠️ أنت بالفعل في *فريق #${att.team}*` };
    }

    const teamNum = parseInt(teamMatch[1]);
    const team    = state.teams.find(t => t.team === teamNum);
    if (!team) {
      return { ok: false, msg: `⚠️ الفريق *#${teamNum}* غير موجود — تحقق من الرقم` };
    }
    if (team.members.length >= 5) {
      return { ok: false, msg: `⚠️ الفريق *#${teamNum}* ممتلئ (الحد الأقصى 5 أعضاء)` };
    }

    updateAttendee(att.id, { team: teamNum });
    team.members.push(att.id);
    logActivity('Actions', 'انضمام لفريق', `${att.name} → فريق #${teamNum}`);

    return {
      ok: true,
      msg: `✅ *انضممت لفريق #${teamNum} يا ${att.name.split(' ')[0]}!*\n\n` +
           `أعضاء فريقك الآن: ${team.members.length}/5\n` +
           `حظاً موفقاً 🚀`
    };
  }

  return null; // ليست action intent
}

module.exports = { tryAction };
