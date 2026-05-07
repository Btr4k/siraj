require('dotenv').config();
const { askDeepSeek }        = require('./deepseek');
const { state, logActivity } = require('../data/state');

const registrarAgent   = require('./registrarAgent');
const attendanceAgent  = require('./attendanceAgent');
const guidanceAgent    = require('./guidanceAgent');
const matchmakingAgent = require('./matchmakingAgent');

// ── Keyword routing (no API call) ──────────────────────────────
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
    agent: 'recommendation',
    keywords: [
      'المحاضرات المناسبة','رتب لي جدول','جدول الحضور','توصية محاضرات','محاضرات مناسبة',
      'ما يناسبني','المحاضر','معلومات عن المحاضر','من هو المحاضر',
      'اقترح لي','رشح لي','ما المحاضرات',
      'أنا مهندس','أنا مصمم','أنا مطور','تخصصي','مستواي'
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

// ── Chained queries (multi-agent) ──────────────────────────────
const CHAIN_ROUTES = [
  {
    name: 'plan_my_day',
    keywords: ['خطط يومي','خطط لي يومي','plan my day','جدول مخصص','ماذا أفعل اليوم','what should i do today'],
    agents: ['guidance', 'recommendation']
  },
  {
    name: 'find_team',
    keywords: ['ساعدني أكوّن فريق','ساعدني في فريق','أريد فريق','أبحث عن فريق','help me find a team','help me form a team','need a team'],
    agents: ['registration', 'matchmaking']
  },
  {
    name: 'team_and_mentor',
    keywords: ['فريقي ومرشدي','من في فريقي ومرشدنا','team and mentor','my team and mentor'],
    agents: ['matchmaking', 'registration']
  }
];

function classifyIntent(message) {
  const lower = message.toLowerCase();

  for (const chain of CHAIN_ROUTES) {
    if (chain.keywords.some(kw => lower.includes(kw))) return `chain:${chain.name}`;
  }
  for (const route of ROUTES) {
    if (route.keywords.some(kw => lower.includes(kw))) return route.agent;
  }
  return 'general';
}

// ── User identity detection ────────────────────────────────────
function tryIdentifyUser(message, userProfile) {
  if (userProfile.name) return;

  const patterns = [
    /(?:أنا|اسمي)\s+([^\s،,\.؟?!\d]{2,15})/,
    /(?:my name is|i(?:'m| am))\s+([^\s,\.!?]{2,20})/i,
  ];

  let candidate = null;
  for (const p of patterns) {
    const m = message.match(p);
    if (m) { candidate = m[1].trim(); break; }
  }

  // Direct first-name match across attendees
  if (!candidate) {
    const words = message.trim().split(/\s+/);
    for (const att of state.attendees) {
      const first = att.name.split(' ')[0];
      if (words.some(w => w === first || (w.length > 2 && first.startsWith(w)))) {
        candidate = first; break;
      }
    }
  }

  if (!candidate) return;

  const found = state.attendees.find(a =>
    a.name.includes(candidate) || candidate.includes(a.name.split(' ')[0])
  );

  if (found) {
    Object.assign(userProfile, {
      name: found.name, skill: found.skill,
      level: found.level, goal: found.goal,
      team: found.team, attendeeId: found.id
    });
    logActivity('Orchestrator', 'عرّف المستخدم', found.name);
  } else {
    userProfile.name = candidate;
  }
}

// ── User context block injected into every system prompt ────────
function buildUserBlock(userProfile) {
  if (!userProfile.name) return '';
  const firstName = userProfile.name.split(' ')[0];
  if (!userProfile.skill) {
    return `\n=== CURRENT USER ===\nName: ${userProfile.name} — address them as "${firstName}"\n`;
  }
  return `\n=== CURRENT USER ===
Name: ${userProfile.name} | Skill: ${userProfile.skill} | Level: ${userProfile.level} | Goal: ${userProfile.goal}
Team: ${userProfile.team ? `#${userProfile.team}` : 'unassigned'}
→ Address them by first name "${firstName}". Tailor your answer to their skill and goal.
`;
}

// ── Proactive suffix for sub-agent responses ───────────────────
function buildProactiveSuffix(userProfile, intent) {
  if (!userProfile.name || !userProfile.skill) return null;
  if (intent === 'general') return null;

  if (!userProfile.team && intent !== 'matchmaking') {
    return '\n\n💡 _فريقك لم يتشكل بعد — اكتب **"ساعدني أكوّن فريق"** إذا أردت مساعدة_';
  }

  const hour = new Date().getHours();
  if (hour >= 8 && hour < 14 && intent !== 'guidance' && intent !== 'recommendation') {
    return '\n\n💡 _اكتب **"خطط يومي"** لأرشح لك أفضل جلسات اليوم بناءً على تخصصك_';
  }

  return null;
}

// ── General / fallback prompt ──────────────────────────────────
function buildGeneralPrompt(userProfile) {
  const attendeeNames = state.attendees.map(a => `${a.name} (مشارك)`).join('، ');
  const mentorNames   = state.mentors.map(m => `${m.name} (مرشد)`).join('، ');
  const userBlock     = buildUserBlock(userProfile);
  const firstName     = userProfile.name?.split(' ')[0];

  const greetingHint = !userProfile.name
    ? `\nIF the user greets you (مرحبا، السلام، hi، hello): introduce yourself in 1-2 lines AND end with "ما اسمك؟ حتى أساعدك بشكل شخصي 😊"`
    : `\nYou already know the user — no need to ask for their name again.`;

  return `You are Siraj — an intelligent multi-agent assistant for "Agenticthon — AI Agents Hackathon".
You coordinate specialized agents: Registration, Attendance, Guidance & Venue, and Matchmaking.
You have access to the conversation history — use it to answer follow-up questions naturally.
Reply in the SAME language as the user. Be warm, helpful, and proactive.
${firstName ? `Address the user as "${firstName}".` : ''}
Start with "🤖 وكيل سراج:" (Arabic) or "🤖 Siraj Agent:" (English).
After answering, suggest ONE relevant next step if it adds value.
${greetingHint}

NEVER invent information about people. Only use the lists below.
${userBlock}
=== KNOWN PARTICIPANTS ===
${attendeeNames}

=== KNOWN MENTORS ===
${mentorNames}

=== EVENT INFO ===
Name: Agenticthon — هاكاثون الوكلاء الذكية
Organizer: نادي الذكاء الاصطناعي – جامعة الأمير سطام | Partner: Beyond IT
Dates: 7–9 May 2026 | Venue: Sports Hall, Prince Sattam University, Al-Kharj
Tracks: 6 (Process Automation, Smart Marketing, Intelligent Call Centers, Smart Education, Multi-Agent Systems, A2A)
Team size: 2–5 members | Prizes: 200,000 SAR
Judging: Registration → Screening → 3-day Sprint → Final Presentation`;
}

// ── Agent chaining ─────────────────────────────────────────────
async function chainAgents(chainName, userMessage, ctx) {
  const chain = CHAIN_ROUTES.find(c => c.name === chainName);
  if (!chain) return null;

  const results = await Promise.all(chain.agents.map(agentName => {
    const ctx2 = { ...ctx };
    if (agentName === 'registration')   return registrarAgent.handle(userMessage, ctx2);
    if (agentName === 'matchmaking')    return matchmakingAgent.handle(userMessage, ctx2);
    if (agentName === 'guidance')       return guidanceAgent.handle(userMessage, ctx2);
    if (agentName === 'recommendation') return guidanceAgent.handleRecommendation(userMessage, ctx2);
    if (agentName === 'attendance')     return attendanceAgent.handle(userMessage, ctx2);
    return null;
  }));

  const parts = results.filter(Boolean);
  return parts.length ? parts.join('\n\n━━━━━━━━━━━━━━━━\n\n') : null;
}

// ── Main entry point ───────────────────────────────────────────
async function route(userMessage, history = [], userProfile = {}) {
  tryIdentifyUser(userMessage, userProfile);

  const intent = classifyIntent(userMessage);
  logActivity('Orchestrator', `توجيه → ${intent}`, userMessage.substring(0, 50));

  const ctx = { history, userProfile };
  let answer = null;

  if (intent.startsWith('chain:')) {
    answer = await chainAgents(intent.slice(6), userMessage, ctx);
  } else {
    switch (intent) {
      case 'registration':
        answer = await registrarAgent.handle(userMessage, ctx);
        break;
      case 'attendance':
        answer = await attendanceAgent.handle(userMessage, ctx);
        break;
      case 'recommendation':
        answer = await guidanceAgent.handleRecommendation(userMessage, ctx);
        break;
      case 'guidance':
        answer = await guidanceAgent.handle(userMessage, ctx);
        break;
      case 'matchmaking':
        answer = await matchmakingAgent.handle(userMessage, ctx);
        break;
      default:
        logActivity('Orchestrator', 'يجيب مباشرة', userMessage.substring(0, 50));
        answer = await askDeepSeek(
          buildGeneralPrompt(userProfile),
          userMessage,
          { temperature: 0.6, history }
        );
        if (answer) logActivity('Orchestrator', 'أجاب', userMessage.substring(0, 40));
    }
  }

  if (answer) {
    state.stats.questionsAnswered++;
    const suffix = buildProactiveSuffix(userProfile, intent);
    if (suffix) answer += suffix;
  }

  return answer || 'عذراً، حدث خطأ. حاول مرة أخرى. / Sorry, please try again.';
}

module.exports = { route, buildUserBlock };
