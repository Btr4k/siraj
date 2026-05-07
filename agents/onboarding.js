const { state, addAttendee, linkTelegramChat } = require('../data/state');
const { MAIN_MENU, BACK_BTN } = require('./telegram');

// chatId → { step: 'name'|'skill'|'level'|'goal', data: {} }
const pending = new Map();

// ── Keyboards ──────────────────────────────────────────────────
const SKILL_KB = {
  inline_keyboard: [
    [{ text: '🤖 AI Engineer',    callback_data: 'ob_skill_AI Engineer'    }, { text: '⚙️ Backend Dev',   callback_data: 'ob_skill_Backend Dev'   }],
    [{ text: '🎨 Frontend Dev',   callback_data: 'ob_skill_Frontend Dev'   }, { text: '✏️ UX Designer',   callback_data: 'ob_skill_UX Designer'   }],
    [{ text: '📊 Data Scientist', callback_data: 'ob_skill_Data Scientist' }, { text: '💼 Business Dev',  callback_data: 'ob_skill_Business Dev'  }],
    [{ text: '🔧 DevOps',         callback_data: 'ob_skill_DevOps'         }]
  ]
};

const LEVEL_KB = {
  inline_keyboard: [[
    { text: '🌱 مبتدئ', callback_data: 'ob_level_مبتدئ' },
    { text: '⚡ متوسط', callback_data: 'ob_level_متوسط' },
    { text: '🔥 متقدم', callback_data: 'ob_level_متقدم' }
  ]]
};

const GOAL_KB = {
  inline_keyboard: [[
    { text: '📚 تعلم',         callback_data: 'ob_goal_تعلم'         },
    { text: '💼 توظيف',        callback_data: 'ob_goal_توظيف'        },
    { text: '🚀 بناء مشروع',   callback_data: 'ob_goal_بناء مشروع'   }
  ]]
};

// ── Public API ─────────────────────────────────────────────────

function isOnboarding(chatId) {
  return pending.has(String(chatId));
}

async function startOnboarding(chatId, sendFn) {
  pending.set(String(chatId), { step: 'name', data: {} });
  await sendFn(chatId,
    '👋 *أهلاً بك في Agenticthon\\!*\n\n' +
    'أنا وكيل *سِراج* — مساعدك الذكي طوال الهاكاثون\\.\n\n' +
    'سأسجّلك في ٣٠ ثانية فقط ⚡\n\n' +
    '*ما اسمك الكامل؟*'
  );
}

// Returns true if message was consumed by onboarding
async function handleText(chatId, text, sendFn) {
  const cid = String(chatId);
  const ob  = pending.get(cid);
  if (!ob || ob.step !== 'name') return false;

  const name = text.trim();
  if (name.length < 2 || name.length > 40) {
    await sendFn(chatId, '⚠️ الاسم يبدو قصيراً أو غير صحيح\\. أدخل اسمك الكامل من فضلك\\.');
    return true;
  }

  // Check if name already exists in attendees list → link and skip
  const existing = state.attendees.find(a =>
    a.name.includes(name) || name.includes(a.name.split(' ')[0])
  );
  if (existing) {
    pending.delete(cid);
    linkTelegramChat(existing.id, cid);
    const fn = existing.name.split(' ')[0];
    await sendFn(chatId,
      `أهلاً مجدداً *${fn}*\\! 🎉\n` +
      `وجدتك في سجلات الهاكاثون\\.\n\n` +
      `💻 *تخصصك:* ${existing.skill}\n` +
      `📊 *مستواك:* ${existing.level}\n` +
      `🎯 *هدفك:* ${existing.goal}\n\n` +
      `_اختر من القائمة أو اكتب سؤالك مباشرة 👇_`,
      MAIN_MENU
    );
    return true;
  }

  ob.data.name = name;
  ob.step = 'skill';
  const firstName = name.split(' ')[0];
  await sendFn(chatId,
    `أهلاً *${firstName}*\\! 🎉\n\n*ما تخصصك؟*`,
    SKILL_KB
  );
  return true;
}

// Returns true if callback was consumed by onboarding
async function handleCallback(chatId, data, sendFn) {
  const cid = String(chatId);
  const ob  = pending.get(cid);
  if (!ob) return false;

  if (data.startsWith('ob_skill_') && ob.step === 'skill') {
    ob.data.skill = data.replace('ob_skill_', '');
    ob.step = 'level';
    await sendFn(chatId, `✅ *${ob.data.skill}*\n\n*ما مستواك؟*`, LEVEL_KB);
    return true;
  }

  if (data.startsWith('ob_level_') && ob.step === 'level') {
    ob.data.level = data.replace('ob_level_', '');
    ob.step = 'goal';
    await sendFn(chatId, `✅ *${ob.data.level}*\n\n*ما هدفك من الهاكاثون؟*`, GOAL_KB);
    return true;
  }

  if (data.startsWith('ob_goal_') && ob.step === 'goal') {
    ob.data.goal = data.replace('ob_goal_', '');
    pending.delete(cid);

    const result = addAttendee(ob.data);
    if (!result.success) {
      await sendFn(chatId, '⚠️ حدث خطأ أثناء التسجيل\\. حاول مرة أخرى أو تواصل مع المنظمين\\.', BACK_BTN);
      return true;
    }

    linkTelegramChat(result.attendee.id, cid);
    const fn = ob.data.name.split(' ')[0];

    await sendFn(chatId,
      `🎉 *تم تسجيلك يا ${fn}\\!*\n\n` +
      `👤 *الاسم:* ${ob.data.name}\n` +
      `💻 *التخصص:* ${ob.data.skill}\n` +
      `📊 *المستوى:* ${ob.data.level}\n` +
      `🎯 *الهدف:* ${ob.data.goal}\n\n` +
      `_يمكنك الآن سؤالي عن الجدول، الفرق، المرشدين، أو أي شيء آخر 👇_`,
      MAIN_MENU
    );
    return true;
  }

  return false;
}

module.exports = { isOnboarding, startOnboarding, handleText, handleCallback };
