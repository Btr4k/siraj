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
const { state, logActivity, resolveAlert, checkinAttendee } = require('./data/state');
const { MAIN_MENU, BACK_BTN, getWelcomeText, handleCallback, setCommands } = require('./agents/telegram');
const { processCommand }                                 = require('./agents/dataManager');

const sessions    = new Map(); // token → { expiresAt }
const SESSION_TTL = 8 * 60 * 60 * 1000;

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

// Public: participant AI Q&A (no auth)
app.post('/api/public/ask', publicAskLimiter, async (req, res) => {
  const { question } = req.body || {};
  if (!question) return res.status(400).json({ error: 'missing question' });
  if (question.length > 500) return res.status(400).json({ error: 'السؤال طويل جداً / Question too long (max 500 chars).' });
  res.json({ answer: await route(question) });
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
    await sendTelegram(chatId, getWelcomeText(), MAIN_MENU);
    return;
  }

  const reply = await route(text);
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
app.post('/api/form-teams',     authMiddleware, async (req, res) => res.json(await formTeams()));
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
