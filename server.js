require('dotenv').config();
const express    = require('express');
const bodyParser = require('body-parser');
const cors       = require('cors');
const axios      = require('axios');
const path       = require('path');
const crypto     = require('crypto');
const rateLimit  = require('express-rate-limit');

const { route }                                          = require('./agents/orchestrator');
const { formTeams }                                      = require('./agents/matchmaker');
const { checkInAll, checkParkingLoad, detectIssues }     = require('./agents/registrar');
const { state, logActivity, resolveAlert, checkinAttendee, addAlert, linkTelegramChat } = require('./data/state');
const { pushToChat } = require('./agents/notifier');
const { MAIN_MENU, BACK_BTN, getWelcomeText, handleCallback, setCommands } = require('./agents/telegram');
const onboarding = require('./agents/onboarding');
const { processCommand }                                 = require('./agents/dataManager');

const sessions    = new Map(); // admin token → { expiresAt }
const SESSION_TTL = 8 * 60 * 60 * 1000;

// ── Public chat sessions: sessionId → { messages, userProfile, expiresAt } ──
const chatSessions = new Map();
const CHAT_TTL     = 2 * 60 * 60 * 1000; // 2 hours

// ── Reminder scheduling ──────────────────────────────────────────
const REMINDER_SESSIONS = {
  'تسجيل':       { time: '09:00', label: 'التسجيل' },
  'افتتاح':      { time: '10:00', label: 'حفل الافتتاح' },
  'غداء':        { time: '13:30', label: 'استراحة الغداء' },
  'lunch':       { time: '13:30', label: 'Lunch Break' },
  'إرشاد':       { time: '15:00', label: 'جلسة الإرشاد' },
  'ارشاد':       { time: '15:00', label: 'جلسة الإرشاد' },
  'mentor':      { time: '15:00', label: 'Mentoring Session' },
  'عرض':         { time: '15:00', label: 'العروض النهائية' },
  'presentation':{ time: '15:00', label: 'Final Presentations' },
  'جوائز':       { time: '19:00', label: 'حفل الجوائز' },
  'ceremony':    { time: '19:00', label: 'Awards Ceremony' },
  'awards':      { time: '19:00', label: 'Awards Ceremony' },
};

function parseReminderTime(text) {
  // Direct clock time: "ذكرني الساعة 14:30"
  const direct = text.match(/(\d{1,2}):(\d{2})/);
  if (direct) {
    const h = parseInt(direct[1]), m = parseInt(direct[2]);
    return { h, m, label: `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`, minBefore: 0 };
  }
  // Session keyword + optional minutes before
  for (const [key, session] of Object.entries(REMINDER_SESSIONS)) {
    if (text.includes(key)) {
      const minBefore = parseInt(text.match(/(\d+)\s*(?:دقيق|min)/i)?.[1] || '30');
      const [sh, sm] = session.time.split(':').map(Number);
      const total = sh * 60 + sm - minBefore;
      return { h: Math.floor(total / 60), m: total % 60, label: session.label, minBefore };
    }
  }
  return null;
}

function scheduleReminder(chatId, parsed) {
  const now  = new Date();
  const fire = new Date();
  fire.setHours(parsed.h, parsed.m, 0, 0);
  const delayMs = fire - now;
  if (delayMs < 60_000) return false; // already passed or < 1 min away

  setTimeout(async () => {
    const isAr = /[؀-ۿ]/.test(parsed.label);
    const msg = isAr
      ? `🔔 *تذكير!*\n*${parsed.label}* ${parsed.minBefore ? `بعد ${parsed.minBefore} دقيقة` : 'الآن'} — توجّه الآن! 🏃`
      : `🔔 *Reminder!*\n*${parsed.label}* ${parsed.minBefore ? `in ${parsed.minBefore} min` : 'now'} — head over! 🏃`;
    await pushToChat(chatId, msg);
  }, delayMs);

  return true;
}

function getOrCreateChatSession(sessionId) {
  if (sessionId) {
    const existing = chatSessions.get(sessionId);
    if (existing && Date.now() < existing.expiresAt) {
      existing.expiresAt = Date.now() + CHAT_TTL; // refresh
      return { sid: sessionId, sess: existing };
    }
    chatSessions.delete(sessionId);
  }
  const sid  = crypto.randomBytes(16).toString('hex');
  const sess = { messages: [], userProfile: {}, expiresAt: Date.now() + CHAT_TTL };
  chatSessions.set(sid, sess);
  return { sid, sess };
}

function authMiddleware(req, res, next) {
  const token = req.headers['x-auth-token'];
  if (!token) return res.status(401).json({ error: 'غير مصرح' });
  const session = sessions.get(token);
  if (!session || Date.now() > session.expiresAt) {
    sessions.delete(token);
    return res.status(401).json({ error: 'انتهت الجلسة' });
  }
  next();
}

const app  = express();
const PORT = process.env.PORT || 3000;
const TG   = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}`;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));

const publicAskLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'طلبات كثيرة، حاول بعد دقيقة / Too many requests, try again in a minute.' }
});

// Public: participant AI Q&A with multi-turn memory
app.post('/api/public/ask', publicAskLimiter, async (req, res) => {
  const { question, sessionId } = req.body || {};
  if (!question) return res.status(400).json({ error: 'missing question' });
  if (question.length > 500) return res.status(400).json({ error: 'السؤال طويل جداً / Question too long (max 500 chars).' });

  const { sid, sess } = getOrCreateChatSession(sessionId);

  // History = previous turns (before current message)
  const history = [...sess.messages];

  // Append current user turn
  sess.messages.push({ role: 'user', content: question });

  const answer = await route(question, history, sess.userProfile);

  // Append assistant turn
  if (answer) sess.messages.push({ role: 'assistant', content: answer });

  // Keep last 16 messages (8 full turns)
  if (sess.messages.length > 16) sess.messages = sess.messages.slice(-16);

  res.json({ answer, sessionId: sid });
});

const publicActionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'طلبات كثيرة، حاول بعد دقيقة.' }
});

// Public: participant self-service actions (no auth)
app.post('/api/public/action', publicActionLimiter, async (req, res) => {
  const { action, data, sessionId } = req.body || {};
  if (!action) return res.status(400).json({ error: 'missing action' });

  const sess     = sessionId ? chatSessions.get(sessionId) : null;
  const userName = sess?.userProfile?.name || data?.name || 'مشارك';

  switch (action) {
    case 'request_mentor': {
      const { projectArea } = data || {};
      const msg = `🆘 طلب مرشد: ${userName} — المجال: ${projectArea || 'غير محدد'}`;
      addAlert(msg, 'warning');
      logActivity('PublicAction', 'طلب مرشد', userName);
      return res.json({ success: true, message: 'تم تسجيل طلبك! سيتواصل معك المنظمون قريباً.' });
    }
    case 'team_interest': {
      const { skill } = data || {};
      logActivity('PublicAction', 'اهتمام بتشكيل فريق', `${userName} (${skill || '؟'})`);
      return res.json({ success: true, message: 'تم تسجيل اهتمامك! سنتواصل معك للتنسيق.' });
    }
    case 'self_checkin': {
      const identifier = data?.name || userName;
      const result = checkinAttendee(identifier);
      return res.json(result);
    }
    default:
      return res.status(400).json({ error: `إجراء غير معروف: ${action}` });
  }
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username !== process.env.ADMIN_USER || password !== process.env.ADMIN_PASS) {
    return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' });
  }
  const token     = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + SESSION_TTL;
  sessions.set(token, { expiresAt });
  logActivity('Auth', 'تسجيل دخول', username);
  res.json({ token, expiresAt });
});

app.post('/api/logout', authMiddleware, (req, res) => {
  sessions.delete(req.headers['x-auth-token']);
  res.json({ ok: true });
});

async function sendTelegram(chatId, text, replyMarkup = null) {
  try {
    const payload = { chat_id: chatId, text, parse_mode: 'Markdown', disable_web_page_preview: false };
    if (replyMarkup) payload.reply_markup = replyMarkup;
    await axios.post(`${TG}/sendMessage`, payload);
  } catch (e) { console.error('TG error:', e.message); }
}

app.post('/webhook', async (req, res) => {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const incoming = req.headers['x-telegram-bot-api-secret-token'];
    if (incoming !== secret) return res.sendStatus(403);
  }
  res.sendStatus(200);

  // ── Button press ──────────────────────────────────────────────
  const cb = req.body?.callback_query;
  if (cb) {
    axios.post(`${TG}/answerCallbackQuery`, { callback_query_id: cb.id }).catch(() => {});
    const chatId = cb.message.chat.id;

    if (cb.data === 'menu') {
      await sendTelegram(chatId, getWelcomeText(), MAIN_MENU);
      return;
    }

    // Onboarding buttons have priority
    if (cb.data.startsWith('ob_')) {
      await onboarding.handleCallback(chatId, cb.data, sendTelegram);
      return;
    }

    const result = handleCallback(cb.data);
    if (result) await sendTelegram(chatId, result.text, result.menu);
    return;
  }

  // ── Text message ──────────────────────────────────────────────
  const msg = req.body?.message;
  if (!msg?.text) return;

  const chatId = msg.chat.id;
  const text   = msg.text.trim().substring(0, 500);

  if (text.startsWith('/start') || text.startsWith('/help')) {
    chatSessions.delete(String(chatId));
    // Already registered? Greet them. Otherwise start onboarding.
    const linked = state.attendees.find(a => a.telegramChatId === String(chatId));
    if (linked) {
      const fn = linked.name.split(' ')[0];
      await sendTelegram(chatId,
        `أهلاً مجدداً *${fn}*\\! 👋\nكيف أساعدك اليوم؟`,
        MAIN_MENU
      );
    } else {
      await onboarding.startOnboarding(chatId, sendTelegram);
    }
    return;
  }

  // ── Onboarding (name text input) ────────────────────────────
  if (onboarding.isOnboarding(chatId)) {
    await onboarding.handleText(chatId, text, sendTelegram);
    return;
  }

  // ── Reminder intent ─────────────────────────────────────────
  if (/ذكرني|تذكيرني|تذكير|remind\s*me/i.test(text)) {
    const parsed = parseReminderTime(text);
    if (parsed) {
      const ok    = scheduleReminder(String(chatId), parsed);
      const isAr  = /[؀-ۿ]/.test(text);
      const msg   = ok
        ? (isAr
            ? `✅ *تم!* سأذكرك ${parsed.minBefore ? `قبل *${parsed.minBefore}* دقيقة من *${parsed.label}*` : `عند الساعة *${parsed.label}*`} 🔔`
            : `✅ *Done!* I'll remind you ${parsed.minBefore ? `${parsed.minBefore} min before *${parsed.label}*` : `at *${parsed.label}*`} 🔔`)
        : (isAr ? '⚠️ الوقت المحدد قد مضى أو اقترب جداً.' : '⚠️ That time has already passed or is too close.');
      await sendTelegram(chatId, msg, BACK_BTN);
      return;
    }
    // No parseable time → fall through to route() for a natural reply
  }

  const { sid, sess } = getOrCreateChatSession(String(chatId));
  const history = [...sess.messages];
  sess.messages.push({ role: 'user', content: text });

  const reply = await route(text, history, sess.userProfile);

  if (reply) sess.messages.push({ role: 'assistant', content: reply });
  if (sess.messages.length > 16) sess.messages = sess.messages.slice(-16);

  // ── Link chatId to attendee once identity is known ──────────
  if (sess.userProfile?.attendeeId) {
    linkTelegramChat(sess.userProfile.attendeeId, String(chatId));
  }

  await sendTelegram(chatId, reply, BACK_BTN);
});

app.get('/api/state', authMiddleware, (req, res) => {
  res.json({
    stats:       state.stats,
    activityLog: state.activityLog.slice(0, 15),
    alerts:      state.alerts,
    teams:       state.teams,
    attendees:   state.attendees,
    mentors:     state.mentors,
    schedule:    state.schedule
  });
});

app.post('/api/checkin-all',    authMiddleware, (req, res) => res.json(checkInAll()));
app.post('/api/checkin',        authMiddleware, (req, res) => {
  const { identifier } = req.body || {};
  if (!identifier) return res.status(400).json({ error: 'missing identifier' });
  res.json(checkinAttendee(identifier));
});
app.post('/api/form-teams', authMiddleware, async (req, res) => {
  const result = await formTeams();
  if (result.success && result.teams?.length) {
    for (const team of result.teams) {
      const members = team.members
        .map(id => state.attendees.find(a => a.id === id))
        .filter(Boolean);
      const memberList = members.map(a => `• *${a.name}* — ${a.skill}`).join('\n');
      const msg = `🎉 *تم تشكيل فريقك في Agenticthon\\!*\n\n*فريق \\#${team.team}*\n${memberList}${team.reason ? `\n\n💡 ${team.reason}` : ''}\n\n_حظاً موفقاً\\! 🚀_`;
      for (const member of members) {
        if (member.telegramChatId) pushToChat(member.telegramChatId, msg).catch(() => {});
      }
    }
  }
  res.json(result);
});
app.post('/api/detect-issues',  authMiddleware, (req, res) => res.json({ issues: detectIssues() }));
app.post('/api/parking',        authMiddleware, (req, res) => res.json(checkParkingLoad()));
app.post('/api/resolve-alert/:id', authMiddleware, (req, res) => { resolveAlert(parseInt(req.params.id)); res.json({ ok: true }); });

app.post('/api/simulate-question', authMiddleware, async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: 'missing question' });
  res.json({ answer: await route(question) });
});

app.post('/api/admin/command', authMiddleware, async (req, res) => {
  const { command } = req.body || {};
  if (!command) return res.status(400).json({ error: 'missing command' });
  const result = await processCommand(command);
  res.json(result);
});

app.listen(PORT, () => {
  console.log(`\n🚀 Siraj running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  logActivity('System', 'بدأ النظام', 'جميع الـ agents جاهزون');
  setTimeout(() => setCommands(TG), 5000);
});
