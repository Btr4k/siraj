const { state, linkTelegramChat } = require('../data/state');
const { getOrCreateProfile, updateProfile } = require('../data/profiles');
const { MAIN_MENU, BACK_BTN } = require('./telegram');

// chatId → { step: 'name_role'|'interests'|'goal' }
const pending = new Map();

// ── Keyboards ──────────────────────────────────────────────────

const ROLE_KB = {
  inline_keyboard: [
    [
      { text: '🎓 مشارك',  callback_data: 'ob_role_attendee'  },
      { text: '🏅 منظم',   callback_data: 'ob_role_organizer' }
    ],
    [
      { text: '🎤 متحدث',  callback_data: 'ob_role_speaker'   }
    ]
  ]
};

const INTEREST_KB = {
  inline_keyboard: [
    [{ text: '🤖 AI Agents',    callback_data: 'ob_int_AI Agents'    }, { text: '🔒 Security',      callback_data: 'ob_int_Security'     }],
    [{ text: '🧠 NLP',          callback_data: 'ob_int_NLP'          }, { text: '📊 Data Science',  callback_data: 'ob_int_Data Science' }],
    [{ text: '📦 Product',      callback_data: 'ob_int_Product'      }, { text: '💼 Business',      callback_data: 'ob_int_Business'     }],
    [{ text: '⚙️ DevOps',       callback_data: 'ob_int_DevOps'       }, { text: '✅ تم الاختيار',   callback_data: 'ob_int_done'         }]
  ]
};

const GOAL_KB = {
  inline_keyboard: [
    [
      { text: '📚 تعلم',          callback_data: 'ob_goal_learn'     },
      { text: '🚀 بناء مشروع',    callback_data: 'ob_goal_build'     }
    ],
    [
      { text: '🤝 تواصل',         callback_data: 'ob_goal_network'   },
      { text: '👔 توظيف',         callback_data: 'ob_goal_hire'      }
    ],
    [
      { text: '💼 أبحث عن عمل',   callback_data: 'ob_goal_get_hired' }
    ]
  ]
};

// ── Public API ─────────────────────────────────────────────────

function isOnboarding(chatId) {
  return pending.has(String(chatId));
}

async function startOnboarding(chatId, sendFn) {
  const cid = String(chatId);
  pending.set(cid, { step: 'name_role', interestsBuffer: [] });
  await sendFn(chatId,
    '👋 *أهلاً بك في Agenticthon!*\n\n' +
    'أنا وكيل *سِراج* — مساعدك الذكي طوال الهاكاثون.\n\n' +
    '*ما اسمك الكامل؟* (مثال: عبدالله العتيبي)'
  );
}

// Name validation: must contain real letters (Arabic or Latin), min 2 words, max 50 chars
const NAME_RE = /^[؀-ۿa-zA-Z][؀-ۿa-zA-Z\s]{2,48}[؀-ۿa-zA-Z]$/;
function isValidName(name) {
  if (!NAME_RE.test(name)) return false;
  const words = name.trim().split(/\s+/).filter(w => w.length > 0);
  return words.length >= 2; // require at least first + last name
}

// Returns true if text was consumed by onboarding
async function handleText(chatId, text, sendFn) {
  const cid = String(chatId);
  const ob  = pending.get(cid);
  if (!ob || ob.step !== 'name_role') return false;

  const name = text.trim();
  if (!isValidName(name)) {
    await sendFn(chatId,
      '⚠️ يرجى إدخال اسمك الكامل (الاسم والكنية على الأقل).\n' +
      'مثال: *عبدالله العتيبي*'
    );
    return true;
  }

  // Check if name matches existing attendee — strict full-name match only
  const existing = state.attendees.find(a => {
    const aParts = a.name.trim().split(/\s+/);
    const nParts = name.trim().split(/\s+/);
    const matched = nParts.filter(w => aParts.some(ap => ap === w)).length;
    return matched >= 2;
  });

  ob.name = name;

  if (existing) {
    // Link attendee and pre-fill profile from existing record
    linkTelegramChat(existing.id, cid);
    updateProfile(cid, {
      name:      existing.name,
      role:      'attendee',
      interests: [existing.skill],
      goal:      existing.goal || 'learn',
      language:  'ar',
      attendeeId: existing.id
    });
    pending.delete(cid);
    const fn = existing.name.split(' ')[0];
    await sendFn(chatId,
      `أهلاً مجدداً *${fn}*\! 🎉\n` +
      `وجدتك في سجلات الهاكاثون\.\n\n` +
      `💻 *تخصصك:* ${existing.skill}\n` +
      `📊 *مستواك:* ${existing.level}\n` +
      `🎯 *هدفك:* ${existing.goal}\n\n` +
      `_اختر من القائمة أو اكتب سؤالك مباشرة 👇_`,
      MAIN_MENU
    );
    return true;
  }

  ob.step = 'role_select';
  const firstName = name.split(' ')[0];
  await sendFn(chatId,
    `أهلاً *${firstName}*\! 🎉\n\n*ما دورك في الهاكاثون؟*`,
    ROLE_KB
  );
  return true;
}

// Returns true if callback was consumed by onboarding
async function handleCallback(chatId, data, sendFn) {
  const cid = String(chatId);
  const ob  = pending.get(cid);
  if (!ob) return false;

  // Step: role selection
  if (data.startsWith('ob_role_') && ob.step === 'role_select') {
    ob.role = data.replace('ob_role_', '');
    ob.step = 'interests';
    const roleLabel = { attendee: 'مشارك', organizer: 'منظم', speaker: 'متحدث' }[ob.role] || ob.role;
    await sendFn(chatId,
      `✅ *${roleLabel}*\n\n*ما اهتماماتك؟ يمكنك اختيار أكثر من واحد\.*\n_اضغط "تم الاختيار" عند الانتهاء_`,
      INTEREST_KB
    );
    return true;
  }

  // Step: interests (multi-select via buffer, done via ob_int_done)
  if (data.startsWith('ob_int_') && ob.step === 'interests') {
    if (data === 'ob_int_done') {
      if (ob.interestsBuffer.length === 0) {
        await sendFn(chatId, '⚠️ اختر اهتماماً واحداً على الأقل\.', INTEREST_KB);
        return true;
      }
      ob.step = 'goal';
      await sendFn(chatId,
        `✅ *${ob.interestsBuffer.join(' • ')}*\n\n*ما هدفك من الهاكاثون؟*`,
        GOAL_KB
      );
    } else {
      const interest = data.replace('ob_int_', '');
      if (!ob.interestsBuffer.includes(interest)) ob.interestsBuffer.push(interest);
      await sendFn(chatId,
        `✅ أضفت: *${interest}*\nالاهتمامات: _${ob.interestsBuffer.join(' • ')}_\n\nاختر المزيد أو اضغط "تم الاختيار"\.`,
        INTEREST_KB
      );
    }
    return true;
  }

  // Step: goal
  if (data.startsWith('ob_goal_') && ob.step === 'goal') {
    const goalRaw = data.replace('ob_goal_', '');
    const goalLabels = {
      learn: 'تعلم', build: 'بناء مشروع', network: 'تواصل',
      hire: 'توظيف', get_hired: 'أبحث عن عمل'
    };
    const goalLabel = goalLabels[goalRaw] || goalRaw;

    // Detect language from name (simple heuristic: Arabic chars → ar)
    const language = /[؀-ۿ]/.test(ob.name) ? 'ar' : 'en';

    updateProfile(cid, {
      name:      ob.name,
      role:      ob.role,
      interests: ob.interestsBuffer,
      goal:      goalRaw,
      language,
      attendeeId: null
    });
    pending.delete(cid);

    const fn = ob.name.split(' ')[0];
    await sendFn(chatId,
      `🎉 *أهلاً ${fn}!* تم إعداد ملفك الشخصي.\n\n` +
      `🎭 *الدور:* ${{ attendee: 'مشارك', organizer: 'منظم', speaker: 'متحدث' }[ob.role] || ob.role}\n` +
      `💡 *الاهتمامات:* ${ob.interestsBuffer.join(' • ')}\n` +
      `🎯 *الهدف:* ${goalLabel}\n\n` +
      `_يمكنك الآن سؤالي عن الجدول، الفرق، المرشدين، أو أي شيء آخر 👇_`,
      MAIN_MENU
    );
    return true;
  }

  return false;
}

module.exports = { isOnboarding, startOnboarding, handleText, handleCallback };
