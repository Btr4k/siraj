require('dotenv').config();
const { askDeepSeek }       = require('./deepseek');
const { state, logActivity } = require('../data/state');

// ── Sub-agents ────────────────────────────────────────────────
const registrarAgent   = require('./registrarAgent');
const attendanceAgent  = require('./attendanceAgent');
const guidanceAgent    = require('./guidanceAgent');
const matchmakingAgent = require('./matchmakingAgent');

// ── Routing: keyword-based (no extra API call) ─────────────────
const ROUTES = [
  {
    agent: 'attendance',
    keywords: [
      'حضور','حاضر','غياب','غائب','check-in','checkin','no-show','وصل','لم يصل',
      'كم حضر','من حضر','attendance','arrived','present','absent','checked in'
    ]
  },
  {
    agent: 'registration',
    keywords: [
      'مشارك','مسجل','تسجيل','مشاركين','سجل','register','signup','attendee','participant',
      'بيانات المشارك','قائمة المشاركين','من سجل','كم مشارك','skills','تخصص',
      'من هو','من هي','من هم','who is','اخبرني عن','معلومات عن','بيانات عن','tell me about','تعرف على'
    ]
  },
  {
    agent: 'matchmaking',
    keywords: [
      'فريق','فرق','مرشد','مرشدين','تطابق','تكوين','match','team','mentor',
      'من في الفريق','يضم','أعضاء الفريق','table assign','جدول الفرق'
    ]
  },
  {
    agent: 'guidance',
    keywords: [
      'جدول','موقع','قاعة','مسار','مسارات','مواقف','واي فاي','wifi','wi-fi',
      'schedule','venue','track','parking','location','hall','how to get','directions',
      'الجدول الزمني','متى','أين','وين','يوم','يبدأ','ينتهي','ساعة'
    ]
  }
];

function classifyIntent(message) {
  const lower = message.toLowerCase();
  for (const route of ROUTES) {
    if (route.keywords.some(kw => lower.includes(kw))) {
      return route.agent;
    }
  }
  return 'general';
}

// ── General fallback (event-wide questions) ────────────────────
function buildGeneralPrompt() {
  const attendeeNames = state.attendees.map(a => `${a.name} (مشارك)`).join('، ');
  const mentorNames   = state.mentors.map(m => `${m.name} (مرشد)`).join('، ');
  return `You are Siraj — the central AI orchestrator for "Agenticthon — AI Agents Hackathon".
You coordinate a team of specialized agents: Registration, Attendance, Guidance & Venue, and Matchmaking.
For this message, no specific sub-agent was matched, so you answer directly with general event knowledge.
Reply in the SAME language as the user. Be concise (2-4 sentences).
Start with "🤖 وكيل سراج:" (Arabic) or "🤖 Siraj Agent:" (English).

CRITICAL RULE: NEVER invent or hallucinate information about any specific person. If asked about a person by name, look them up ONLY in the lists below. If the name is not found, say clearly that you cannot find this person in the system.

=== KNOWN PARTICIPANTS (مشاركون — منافسون في الهاكاثون) ===
${attendeeNames}

=== KNOWN MENTORS (مرشدون — مختلفون تماماً عن المشاركين) ===
${mentorNames}

=== EVENT INFO ===
Name: Agenticthon — هاكاثون الوكلاء الذكية
Organizer: نادي الذكاء الاصطناعي – جامعة الأمير سطام | Partner: Beyond IT
Dates: 7–9 May 2026 | Venue: Sports Hall, Prince Sattam University, Al-Kharj
Tracks: 6 (Process Automation, Smart Marketing, Intelligent Call Centers, Smart Education, Multi-Agent Systems, A2A)
Team size: 2–5 members
Judging: Registration → Screening → 3-day Sprint → Final Presentation`;
}

async function route(userMessage) {
  const intent = classifyIntent(userMessage);
  logActivity('Orchestrator', `توجيه → ${intent}`, userMessage.substring(0, 50));

  let answer = null;

  switch (intent) {
    case 'registration':
      answer = await registrarAgent.handle(userMessage);
      break;
    case 'attendance':
      answer = await attendanceAgent.handle(userMessage);
      break;
    case 'guidance':
      answer = await guidanceAgent.handle(userMessage);
      break;
    case 'matchmaking':
      answer = await matchmakingAgent.handle(userMessage);
      break;
    default:
      logActivity('Orchestrator', 'يجيب مباشرة', userMessage.substring(0, 50));
      answer = await askDeepSeek(buildGeneralPrompt(), userMessage, { temperature: 0.6 });
      if (answer) logActivity('Orchestrator', 'أجاب', userMessage.substring(0, 40));
  }

  if (answer) state.stats.questionsAnswered++;

  return answer || 'عذراً، حدث خطأ. حاول مرة أخرى. / Sorry, please try again.';
}

module.exports = { route };
