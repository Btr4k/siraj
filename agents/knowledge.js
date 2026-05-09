const { askDeepSeek } = require('./deepseek');
const { state, logActivity } = require('../data/state');

const SYSTEM = `You are the Knowledge Agent for Agenticthon hackathon.
Your job: explain concepts, answer "who is X" queries, summarize workshops, recommend resources, and describe participants/speakers.

LANGUAGE RULE (CRITICAL): Detect the language of the user's message and reply ENTIRELY in that language. Arabic → Arabic. English → English. Any language → same language. Never mix.

OUTPUT FORMAT:
• Start with "🧠 [Knowledge label in the user's language]:" on its own line
• Arabic label: وكيل المعرفة | English label: Knowledge Agent
• Bold key values: **RAG**, **د. فهدة المرشد**
• Max 10 lines. Use bullet list or short paragraph as appropriate.

DIFFICULTY ADAPTATION:
• If user.level = 'مبتدئ'/'beginner' → use simple analogies, avoid jargon
• If user.level = 'متقدم'/'advanced' → use technical depth, skip basics
• Default → balanced explanation

PARTICIPANT/SPEAKER QUERIES ("من هو X" / "who is X"):
1. Search PARTICIPANTS LIST for name match (partial OK) → return their skill, level, goal
2. Search WORKSHOPS for speaker match → return their speakerBio
3. Search MENTORS for name match → return their specialty + availability
4. If none found → say: "لا يوجد شخص بهذا الاسم في سجلات الهاكاثون"

CONCEPT QUERIES:
• For AI/tech concepts → give a crisp definition + one real-world example
• Relate examples to the hackathon tracks when possible

EXAMPLE — Arabic "اشرح لي RAG":
🧠 وكيل المعرفة:

• **RAG** (Retrieval-Augmented Generation): نموذج الذكاء الاصطناعي يبحث في قاعدة بيانات ثم يولد الإجابة
• مثال: وكيل يبحث في وثائق الشركة ثم يجيب على أسئلة الموظفين
• مرتبط بمسار: **أتمتة العمليات**

EXAMPLE — English "who is Dr. Fahda?":
🧠 Knowledge Agent:

• **د. فهدة المرشد** — AI Security specialist
• Workshop: "Why Most Agent Demos Are Security Disasters" — Day 1 at 16:00`;

function buildContext(userProfile = {}) {
  const workshopsText = state.schedule
    .filter(item => item.speaker)
    .map(item => {
      const displayTitle = item.titleAr ? `${item.titleAr} / ${item.title}` : item.title;
      return `[WORKSHOP] يوم${item.day} ${item.time} — ${displayTitle} | المحاضر: ${item.speaker} — ${item.speakerBio || 'لا توجد سيرة'} | مهارات: ${(item.relevantSkills || []).join(', ') || 'عام'}`;
    }).join('\n');

  const participantsText = state.attendees.map(a =>
    `[PARTICIPANT] ${a.name} | مهارة: ${a.skill} | مستوى: ${a.level} | هدف: ${a.goal}`
  ).join('\n');

  const mentorsText = state.mentors.map(m =>
    `[MENTOR] ${m.name} | تخصص: ${m.specialty} | ${m.available ? 'متاح' : 'مشغول'}`
  ).join('\n');

  const userNote = userProfile.skill || userProfile.level
    ? `\nCURRENT USER: skill=${userProfile.skill || '?'}, level=${userProfile.level || 'متوسط'} — adapt explanation accordingly`
    : '';

  return `
=== WORKSHOPS & SPEAKERS ===
${workshopsText || '(لا توجد ورش عمل في الجدول)'}

=== PARTICIPANTS LIST ===
${participantsText || '(لا يوجد مشاركون مسجلون)'}

=== MENTORS LIST ===
${mentorsText || '(لا يوجد مرشدون)'}

=== HACKATHON TRACKS ===
1. أتمتة العمليات (Process Automation)
2. التسويق الذكي (Smart Marketing)
3. مراكز الاتصال الذكية (Intelligent Call Centers)
4. التعليم الذكي (Smart Education)
5. أنظمة متعددة الوكلاء (Multi-Agent Systems)
6. تواصل وكيل إلى وكيل (Agent-to-Agent / A2A)
${userNote}`;
}

async function handle(message, ctx = {}) {
  const { history = [], userProfile = {} } = ctx;
  logActivity('KnowledgeAgent', 'يعالج سؤالاً', message.substring(0, 50));
  const answer = await askDeepSeek(
    SYSTEM + buildContext(userProfile),
    message,
    { temperature: 0.6, history }
  );
  if (answer) logActivity('KnowledgeAgent', 'أجاب', message.substring(0, 40));
  return answer;
}

module.exports = { handle };
