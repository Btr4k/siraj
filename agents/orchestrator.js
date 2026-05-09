require('dotenv').config();
const { askDeepSeek }        = require('./deepseek');
const { state, logActivity } = require('../data/state');
const { eventConfig }        = require('../data/event-config');
const { getOrCreateProfile } = require('../data/profiles');

const navigationAgent = require('./navigation');
const scheduleAgent   = require('./schedule');
const networkingAgent = require('./networking');
const knowledgeAgent  = require('./knowledge');

// ── Vocabulary remapping ───────────────────────────────────────
function remapVocabulary(message) {
  if (!eventConfig.enabledFeatures.lectures && /محاضر[ةات]?|lecture/i.test(message)) {
    return message.replace(/محاضر[ةات]?/g, 'ورشة').replace(/lecture[s]?/gi, 'workshop');
  }
  return message;
}

// ── Keyword routing ────────────────────────────────────────────
const ROUTES = [
  {
    agent: 'navigation',
    keywords: [
      'موقف','سيارة','ركن','قاعة','أين','وين','طريق','خريطة','مدخل','الجامعة','الصالة',
      'parking','room','hall','where','route','map','entrance','navigation','location',
      'كيف أصل','كيف اصل','اتجاه','directions','how to get','venue','waze','maps'
    ]
  },
  {
    agent: 'schedule',
    keywords: [
      'جدول','موعد','جلسة','ورشة','تذكير','توقيت','متى','يبدأ','ينتهي','اليوم الأول','اليوم الثاني','اليوم الثالث',
      'schedule','session','workshop','when','time','agenda','reminder','next session','day 1','day 2','day 3'
    ]
  },
  {
    agent: 'networking',
    keywords: [
      'فريق','منتور','مرشد','مرشدين','تواصل','تكوين فريق','تطابق',
      'team','mentor','network','connect','investor','partner',
      'ساعدني أكوّن فريق','ساعدني في فريق','help me find a team','help me form a team','need a team',
      'أبي فريق','أريد فريق','أبحث عن فريق',
      'احتاج فريق','احتاج مرشد','احتاج منتور','أحتاج فريق','أحتاج مرشد',
      'need mentor','looking for team','looking for mentor'
    ]
  },
  {
    agent: 'knowledge',
    keywords: [
      'شرح','اشرح','ملخص','ملخص ورشة','مفهوم','ماذا يعني','من المتحدث','أوصِ','من هو','من هي',
      'explain','summary','what is','who is','recommend','concept','participant',
      'مشارك','سيرة','من المحاضر','المحاضر','speakerbio','speaker bio'
    ]
  }
];

// ── Chain queries (multi-agent) ────────────────────────────────
const CHAIN_ROUTES = [
  {
    name: 'plan_my_day',
    keywords: ['خطط يومي','خطط لي يومي','plan my day','جدول مخصص','ماذا أفعل اليوم','what should i do today'],
    agents: ['schedule', 'knowledge']
  },
  {
    name: 'find_team',
    keywords: ['ساعدني أكوّن فريق','ساعدني في فريق','help me find a team','help me form a team'],
    agents: ['networking']
  },
  {
    name: 'team_and_mentor',
    keywords: ['فريقي ومرشدي','من في فريقي ومرشدنا','team and mentor','my team and mentor'],
    agents: ['networking']
  }
];

function classifyIntent(message) {
  const lower = message.toLowerCase();

  for (const chain of CHAIN_ROUTES) {
    if (chain.keywords.some(kw => lower.includes(kw))) return `chain:${chain.name}`;
  }

  let bestAgent = null;
  let bestLen   = 0;
  for (const route of ROUTES) {
    for (const kw of route.keywords) {
      if (lower.includes(kw) && kw.length > bestLen) {
        bestLen   = kw.length;
        bestAgent = route.agent;
      }
    }
  }
  return bestAgent || 'general';
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

// ── Merge Telegram profile into session userProfile ─────────────
function mergeProfileContext(userProfile, telegramChatId) {
  if (!telegramChatId) return userProfile;
  const profile = getOrCreateProfile(telegramChatId);
  const merged  = { ...userProfile };
  if (!merged.name  && profile.name)   merged.name  = profile.name;
  if (!merged.skill && profile.interests && profile.interests.length > 0) {
    merged.skill = profile.interests[0];
  }
  if (!merged.goal  && profile.goal)   merged.goal  = profile.goal;
  if (!merged.level) merged.level = 'متوسط';
  merged.telegramProfile = profile;
  return merged;
}

// ── User context block ─────────────────────────────────────────
function buildUserBlock(userProfile) {
  if (!userProfile.name) return '';
  const firstName = userProfile.name.split(' ')[0];
  if (!userProfile.skill) {
    return `\n=== CURRENT USER ===\nName: ${userProfile.name} — address them as "${firstName}"\n`;
  }
  return `\n=== CURRENT USER ===
Name: ${userProfile.name} | Skill: ${userProfile.skill} | Level: ${userProfile.level || 'متوسط'} | Goal: ${userProfile.goal || '?'}
Team: ${userProfile.team ? `#${userProfile.team}` : 'unassigned'}
→ Address them by first name "${firstName}". Tailor your answer to their skill and goal.
`;
}

// ── Proactive suffix ───────────────────────────────────────────
function buildProactiveSuffix(userProfile, intent) {
  if (!userProfile.name || !userProfile.skill) return null;
  if (intent === 'general') return null;

  if (!userProfile.team && intent !== 'networking') {
    return '\n\n💡 _فريقك لم يتشكل بعد — اكتب **"أبي فريق"** إذا أردت مساعدة_';
  }

  const hour = new Date().getHours();
  if (hour >= 8 && hour < 14 && intent !== 'schedule') {
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
    ? `\nIF the user greets you: introduce yourself in 1-2 lines then ask for their name — respond in the EXACT same language they used, no exceptions.`
    : `\nYou already know the user — no need to ask for their name again.`;

  return `You are Siraj — an intelligent multi-agent assistant for "Agenticthon — AI Agents Hackathon".
You coordinate 4 specialized agents: Navigation, Schedule, Networking, and Knowledge.
You have access to the conversation history — use it to answer follow-up questions naturally.

LANGUAGE RULE (CRITICAL): Detect the language of the user's message and reply ENTIRELY in that language — Arabic, English, Chinese, French, or any other. Never mix languages in a single response.

OUTPUT FORMAT:
• Start with "🤖 [Siraj label in the user's language]:" on its own line
• EXAMPLE Arabic → 🤖 وكيل سراج:
• EXAMPLE English → 🤖 Siraj Agent:
• EXAMPLE Chinese → 🤖 Siraj助手:
• EXAMPLE French → 🤖 Agent Siraj:
• After answering, suggest ONE relevant next step if it adds value.
${firstName ? `Address the user as "${firstName}".` : ''}
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
Phase: ${state.eventPhase}`;
}

// ── Agent dispatch ─────────────────────────────────────────────
async function dispatchAgent(agentName, userMessage, ctx) {
  switch (agentName) {
    case 'navigation': return navigationAgent.handle(userMessage, ctx);
    case 'schedule':   return scheduleAgent.handle(userMessage, { ...ctx, eventPhase: state.eventPhase });
    case 'networking': return networkingAgent.handle(userMessage, ctx);
    case 'knowledge':  return knowledgeAgent.handle(userMessage, ctx);
    default:           return null;
  }
}

async function chainAgents(chainName, userMessage, ctx) {
  const chain = CHAIN_ROUTES.find(c => c.name === chainName);
  if (!chain) return null;

  const results = await Promise.all(chain.agents.map(a => dispatchAgent(a, userMessage, ctx)));
  const parts = results.filter(Boolean);
  return parts.length ? parts.join('\n\n━━━━━━━━━━━━━━━━\n\n') : null;
}

// ── Main entry point ───────────────────────────────────────────
async function route(userMessage, history = [], userProfile = {}, telegramChatId = null) {
  const mapped = remapVocabulary(userMessage);
  const merged = mergeProfileContext(userProfile, telegramChatId);
  tryIdentifyUser(mapped, merged);

  const intent = classifyIntent(mapped);
  logActivity('Orchestrator', `توجيه → ${intent}`, mapped.substring(0, 50));

  const ctx = { history, userProfile: merged };
  let answer = null;

  if (intent.startsWith('chain:')) {
    answer = await chainAgents(intent.slice(6), mapped, ctx);
  } else if (intent !== 'general') {
    answer = await dispatchAgent(intent, mapped, ctx);
  } else {
    logActivity('Orchestrator', 'يجيب مباشرة', mapped.substring(0, 50));
    answer = await askDeepSeek(
      buildGeneralPrompt(merged),
      mapped,
      { temperature: 0.6, history }
    );
    if (answer) logActivity('Orchestrator', 'أجاب', mapped.substring(0, 40));
  }

  if (answer) {
    state.stats.questionsAnswered++;
    const suffix = buildProactiveSuffix(merged, intent);
    if (suffix) answer += suffix;
    // Sync detected identity back to caller's userProfile
    if (merged.name && !userProfile.name) Object.assign(userProfile, merged);
  }

  return answer || 'Sorry, something went wrong. Please try again.';
}

module.exports = { route, buildUserBlock, classifyIntent };
