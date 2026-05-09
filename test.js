require('dotenv').config();
const { route, classifyIntent } = require('./agents/orchestrator');
const { tryAction }             = require('./agents/actions');
const { state }                 = require('./data/state');

let passed = 0, failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

const ROUTE_CASES = [
  // Navigation
  { input: 'وين المواقف؟',                expected: 'navigation' },
  { input: 'كيف أصل للجامعة؟',            expected: 'navigation' },
  { input: 'where is the parking?',       expected: 'navigation' },
  { input: 'أين الصالة الرياضية؟',        expected: 'navigation' },
  // Schedule
  { input: 'متى أول ورشة؟',              expected: 'schedule'   },
  { input: 'ما جدول اليوم الأول؟',        expected: 'schedule'   },
  { input: 'what time does it start?',   expected: 'schedule'   },
  { input: 'اليوم الثاني برنامجه شو؟',   expected: 'schedule'   },
  // Networking
  { input: 'أبي فريق',                   expected: 'networking' },
  { input: 'احتاج مرشد',                 expected: 'networking' },
  { input: 'I need a mentor',            expected: 'networking' },
  { input: 'من المرشدون المتاحون؟',       expected: 'networking' },
  // Knowledge
  { input: 'اشرح لي ما هو RAG',          expected: 'knowledge'  },
  { input: 'من هو د. محسن بلال؟',        expected: 'knowledge'  },
  { input: 'what is A2A protocol?',      expected: 'knowledge'  },
  { input: 'ملخص ورشة الأمن',            expected: 'knowledge'  },
  // General (should NOT match a specific agent)
  { input: 'مرحبا',                       expected: 'general'    },
  { input: 'ما هي الجوائز؟',             expected: 'general'    },
];

// ══ LEVEL 2: Response Format (calls LLM — slow) ══════════════
const FORMAT_CASES = [
  { input: 'وين الجامعة؟',        prefix: '🧭',  hasLinks: true  },
  { input: 'متى أول جلسة؟',      prefix: '📅',  hasLinks: false },
  { input: 'أبي فريق',           prefix: '🤝',  hasLinks: false },
  { input: 'اشرح لي RAG',        prefix: '🧠',  hasLinks: false },
];

// ══ LEVEL 3: Actions ═════════════════════════════════════════
async function runActionTests() {
  console.log('\n─── Level 3: Action Tests ───────────────────────────');

  // Check-in with unknown user (no chatId link)
  const r1 = await tryAction('سجل حضوري', '000000', {});
  assert('check-in unknown user → error message', r1 && !r1.ok);

  // Check-in with full name (finds attendee)
  const firstAtt = state.attendees[0];
  if (firstAtt) {
    const r2 = await tryAction(`سجل حضوري ${firstAtt.name}`, '000001', {});
    assert(`check-in "${firstAtt.name}" → success or already checked`, r2 !== null);
    if (r2 && r2.ok) {
      assert('attendee actually marked checked-in', state.attendees.find(a => a.id === firstAtt.id)?.checkedIn === true);
    }
  }

  // Check-in with single word → should reject
  const r3 = await tryAction('سجل حضوري عبدالله', '000002', {});
  assert('check-in single word name → rejected', r3 && !r3.ok, r3?.msg?.substring(0, 40));

  // Mentor request
  const r4 = await tryAction('أبي مرشد', '000003', {});
  assert('mentor request → returns message', r4 !== null && r4.msg);

  // Team join — non-existent team
  const r5 = await tryAction('انضم لفريق 999', '000004', { attendeeId: state.attendees[0]?.id });
  assert('join non-existent team → error', r5 && !r5.ok);
}

// ══ MAIN ═════════════════════════════════════════════════════
async function main() {
  const args = process.argv.slice(2);
  const runLLM = args.includes('--llm');

  console.log('┌─────────────────────────────────────────────────┐');
  console.log('│         Siraj — Automated Test Suite            │');
  console.log('└─────────────────────────────────────────────────┘\n');

  // ── Level 1: Routes ────────────────────────────────────────
  console.log('─── Level 1: Route Classification ───────────────────');
  for (const c of ROUTE_CASES) {
    const got = classifyIntent(c.input);
    assert(`"${c.input.substring(0,30)}" → ${c.expected}`, got === c.expected, `got: ${got}`);
  }

  // ── Level 2: LLM Format (opt-in) ──────────────────────────
  if (runLLM) {
    console.log('\n─── Level 2: Response Format (LLM) ──────────────────');
    for (const c of FORMAT_CASES) {
      const answer = await route(c.input, [], {});
      assert(`"${c.input}" starts with ${c.prefix}`, answer.includes(c.prefix), answer.substring(0,60));
      if (c.hasLinks) {
        assert(`"${c.input}" contains maps link`, answer.includes('maps.google.com') || answer.includes('waze.com'));
      }
    }
  } else {
    console.log('\n─── Level 2: Response Format  (skipped — run with --llm) ─');
  }

  // ── Level 3: Actions ───────────────────────────────────────
  await runActionTests();

  // ── Summary ────────────────────────────────────────────────
  const total = passed + failed;
  console.log(`\n${'─'.repeat(51)}`);
  console.log(`  ${passed}/${total} passed  ${failed > 0 ? `| ${failed} FAILED` : '| all green ✅'}`);
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
