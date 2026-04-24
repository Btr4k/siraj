const axios = require('axios');
const { state } = require('../data/state');

const MAIN_MENU = {
  inline_keyboard: [
    [
      { text: '📅 الجدول',      callback_data: 'schedule' },
      { text: '🏆 الجوائز',     callback_data: 'prizes'   }
    ],
    [
      { text: '🛤 المسارات',    callback_data: 'tracks'   },
      { text: '🎓 المرشدون',    callback_data: 'mentors'  }
    ],
    [
      { text: '👥 الفرق',       callback_data: 'teams'    },
      { text: '📍 الموقع',      callback_data: 'location' }
    ],
    [
      { text: '🤖 اسألني أي سؤال', callback_data: 'ask'   }
    ]
  ]
};

const BACK_BTN = {
  inline_keyboard: [[
    { text: '🔙 القائمة الرئيسية', callback_data: 'menu' }
  ]]
};

function getWelcomeText() {
  const s = state.stats;
  return (
    `✨ *أهلاً بك في سِراج!*\n\n` +
    `🤖 مساعدك الذكي في\n` +
    `🚀 *Agenticthon — AI Agents Hackathon*\n\n` +
    `📍 الصالة الرياضية – جامعة الأمير سطام، الخرج\n` +
    `📅 7–9 مايو 2026 • 🏆 هاكاثون الوكلاء الذكية\n\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `اختر من القائمة أو اكتب سؤالك مباشرة 👇`
  );
}

function handleCallback(data) {
  switch (data) {
    case 'schedule': return buildSchedule();
    case 'prizes':   return buildPrizes();
    case 'tracks':   return buildTracks();
    case 'teams':    return buildTeams();
    case 'mentors':  return buildMentors();
    case 'parking':  return buildParking();
    case 'wifi':     return buildWifi();
    case 'location': return buildLocation();
    case 'ask':      return { text: '🤖 اكتب سؤالك الآن وسأجيبك فوراً ✍️', menu: BACK_BTN };
    default:         return null;
  }
}

function buildSchedule() {
  let text = '📅 *جدول Agenticthon — 3 أيام*\n━━━━━━━━━━━━━━━━\n\n';
  state.schedule.forEach(item => {
    text += `🕐 \`${item.time}\`  *${item.title}*\n📍 ${item.hall}\n\n`;
  });
  return { text, menu: BACK_BTN };
}

function buildPrizes() {
  return {
    text: (
      `🏆 *الجوائز والمزايا*\n━━━━━━━━━━━━━━━━\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `✅ دعم للمشاريع الفائزة\n` +
      `✅ إرشاد احترافي من خبراء الصناعة\n` +
      `✅ ربط مع جهات استثمارية\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `👥 حجم الفريق: من 2 إلى 5 أعضاء\n` +
      `📋 التسجيل: مغلق حالياً`
    ),
    menu: BACK_BTN
  };
}

function buildTracks() {
  return {
    text: (
      `🛤 *مسارات Agenticthon — 6 مسارات*\n━━━━━━━━━━━━━━━━\n\n` +
      `1️⃣ *أتمتة العمليات*\n_بناء وكلاء لأتمتة العمليات التجارية_\n\n` +
      `2️⃣ *التسويق الذكي*\n_وكلاء AI للتسويق والمبيعات_\n\n` +
      `3️⃣ *مراكز الاتصال الذكية*\n_خدمة العملاء والوكلاء الصوتيين_\n\n` +
      `4️⃣ *التعليم الذكي*\n_وكلاء للتعلم والتدريس_\n\n` +
      `5️⃣ *أنظمة متعددة الوكلاء*\n_بناء أنظمة تتعاون فيها عدة وكلاء_\n\n` +
      `6️⃣ *تواصل وكيل إلى وكيل (A2A)*\n_بروتوكولات التواصل بين الوكلاء_\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `🤖 اكتب سؤالاً عن أي مسار لأساعدك في الاختيار!`
    ),
    menu: BACK_BTN
  };
}

function buildTeams() {
  if (state.teams.length === 0) {
    return {
      text: `👥 *الفرق*\n━━━━━━━━━━━━━━━━\n\n⏳ لم يتم تكوين فرق بعد.\nسيتم الإعلان قريباً!`,
      menu: BACK_BTN
    };
  }
  let text = `👥 *الفرق المكوّنة — ${state.teams.length} فرق*\n━━━━━━━━━━━━━━━━\n\n`;
  state.teams.forEach(t => {
    const members = t.members.map(id => {
      const a = state.attendees.find(x => x.id === id);
      return a ? `• ${a.name} _(${a.skill})_` : `• #${id}`;
    });
    text += `🔹 *الفريق #${t.team}*\n${members.join('\n')}`;
    if (t.reason) text += `\n💡 _${t.reason}_`;
    text += '\n\n';
  });
  return { text, menu: BACK_BTN };
}

function buildMentors() {
  const available = state.mentors.filter(m => m.available);
  const busy      = state.mentors.filter(m => !m.available);
  let text = `🎓 *المرشدون*\n━━━━━━━━━━━━━━━━\n\n`;
  if (available.length) {
    text += `✅ *متاحون الآن:*\n`;
    available.forEach(m => { text += `  • ${m.name}\n    _${m.specialty}_\n\n`; });
  }
  if (busy.length) {
    text += `🔴 *مشغولون حالياً:*\n`;
    busy.forEach(m => { text += `  • ${m.name}\n`; });
  }
  return { text, menu: BACK_BTN };
}

function buildParking() {
  const pct     = state.stats.registered > 0
    ? Math.round((state.stats.checkedIn / state.stats.registered) * 100)
    : 0;
  const filled  = Math.round(pct / 10);
  const bar     = '🟩'.repeat(filled) + '⬜'.repeat(10 - filled);
  const status  = pct >= 80 ? '🔴 ممتلئ — استخدم P2' : pct >= 60 ? '🟡 ازدحام متوسط' : '🟢 متاح بشكل جيد';
  return {
    text: (
      `🅿️ *حالة المواقف*\n━━━━━━━━━━━━━━━━\n\n` +
      `*P1 — المدخل الشمالي* (150 سيارة)\n` +
      `${bar} ${pct}%\n` +
      `الحالة: ${status}\n\n` +
      `*P2 — المدخل الجنوبي* (80 سيارة)\n` +
      `_بديل متاح عند امتلاء P1_`
    ),
    menu: BACK_BTN
  };
}

function buildWifi() {
  return {
    text: (
      `📶 *الواي فاي*\n━━━━━━━━━━━━━━━━\n\n` +
      `🌐 الشبكة:\n\`Siraj-Event\`\n\n` +
      `🔑 كلمة المرور:\n\`${process.env.WIFI_PASSWORD || 'hackathon2025'}\`\n\n` +
      `_اضغط على النص لنسخه_`
    ),
    menu: BACK_BTN
  };
}

function buildLocation() {
  return {
    text: (
      `📍 *الموقع*\n━━━━━━━━━━━━━━━━\n\n` +
      `🏛 *الصالة الرياضية*\n_جامعة الأمير سطام بن عبدالعزيز، الخرج_\n\n` +
      `📅 *المواعيد:* 7–9 مايو 2026\n\n` +
      `[🗺 افتح في خرائط Google](https://maps.google.com/?q=جامعة+الأمير+سطام+بن+عبدالعزيز+الخرج)`
    ),
    menu: BACK_BTN
  };
}

async function setCommands(TG) {
  try {
    await axios.post(`${TG}/setMyCommands`, {
      commands: [
        { command: 'start', description: '🌟 ابدأ من هنا — القائمة الرئيسية' },
        { command: 'help',  description: '❓ المساعدة والأوامر' }
      ]
    });
    console.log('✅ Telegram commands registered');
  } catch (e) {
    console.error('setCommands error:', e.message);
  }
}

module.exports = { MAIN_MENU, BACK_BTN, getWelcomeText, handleCallback, setCommands };
