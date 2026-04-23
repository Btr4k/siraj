const mentors = [
  { id: 1, name: "د. أحمد الفارسي",  specialty: "NLP & Machine Learning", available: true,  team: null },
  { id: 2, name: "أ. نورة السبيعي",  specialty: "Product & UX",           available: true,  team: null },
  { id: 3, name: "أ. خالد الزهراني", specialty: "Cloud & DevOps",         available: false, team: 3   },
  { id: 4, name: "د. سارة العمري",   specialty: "Business & Startups",    available: true,  team: null },
  { id: 5, name: "د. محمد الدوسري",  specialty: "Data Science & AI",      available: false, team: 1   }
];

const schedule = [
  { time: "09:00", title: "التسجيل والاستقبال",            hall: "المدخل الرئيسي",   duration: 60  },
  { time: "10:00", title: "حفل الافتتاح الرسمي",           hall: "الصالة الرياضية",  duration: 60  },
  { time: "11:00", title: "بداية تطوير المشاريع — اليوم 1", hall: "جميع القاعات",     duration: 480 },
  { time: "13:30", title: "استراحة الغداء",                 hall: "منطقة الطعام",     duration: 60  },
  { time: "15:00", title: "جلسات الإرشاد والتوجيه",         hall: "قاعات المرشدين",   duration: 120 },
  { time: "09:00", title: "تطوير المشاريع — اليوم 2",       hall: "جميع القاعات",     duration: 540 },
  { time: "09:00", title: "تطوير المشاريع — اليوم 3",       hall: "جميع القاعات",     duration: 360 },
  { time: "15:00", title: "عروض المشاريع أمام لجنة التحكيم", hall: "الصالة الرياضية", duration: 180 },
  { time: "19:00", title: "حفل الختام وتوزيع الجوائز",      hall: "الصالة الرياضية", duration: 90  }
];

const venue = {
  name:      "الصالة الرياضية – جامعة الأمير سطام بن عبدالعزيز",
  address:   "جامعة الأمير سطام بن عبدالعزيز، الخرج",
  event:     "Agenticthon — AI Agents Hackathon",
  dates:     "7–9 مايو 2026",
  organizer: "نادي الذكاء الاصطناعي – كلية هندسة وعلوم الحاسب",
  patron:    "رئيس جامعة الأمير سطام بن عبدالعزيز",
  partner:   "بيوند لتقنية المعلومات (Beyond IT)",
  prizes:    "200,000 ريال سعودي",
  teamSize:  "2 إلى 5 أعضاء",
  tracks: [
    "أتمتة العمليات",
    "التسويق الذكي",
    "مراكز الاتصال الذكية",
    "التعليم الذكي",
    "أنظمة متعددة الوكلاء",
    "تواصل وكيل إلى وكيل (A2A)"
  ],
  maps: "https://maps.google.com/?q=جامعة+الأمير+سطام+بن+عبدالعزيز+الخرج",
  faq: [
    { q: "متى الهاكاثون؟",              a: "من 7 إلى 9 مايو 2026 — ثلاثة أيام مكثفة" },
    { q: "وين يصير الهاكاثون؟",         a: "الصالة الرياضية – جامعة الأمير سطام بن عبدالعزيز، الخرج" },
    { q: "كم عدد أعضاء الفريق؟",        a: "من 2 إلى 5 أعضاء" },
    { q: "كم الجوائز؟",                 a: "جوائز مالية بإجمالي 200,000 ريال سعودي، بالإضافة لدعم مشاريع وربط استثماري وإرشاد احترافي" },
    { q: "ما هي المسارات؟",             a: "6 مسارات: أتمتة العمليات، التسويق الذكي، مراكز الاتصال الذكية، التعليم الذكي، أنظمة متعددة الوكلاء، وتواصل A2A" },
    { q: "من ينظم الهاكاثون؟",          a: "نادي الذكاء الاصطناعي بكلية هندسة وعلوم الحاسب، بشراكة بيوند لتقنية المعلومات، تحت رعاية رئيس جامعة الأمير سطام" },
    { q: "من يمكنه المشاركة؟",          a: "طلاب الجامعات، المطورون، المصممون، وكل المهتمين بالذكاء الاصطناعي والتقنيات الناشئة" },
    { q: "هل التسجيل مفتوح؟",           a: "التسجيل مغلق حالياً" },
    { q: "When is the hackathon?",      a: "May 7–9, 2026 — three intensive days" },
    { q: "Where is the venue?",         a: "Sports Hall – Prince Sattam bin Abdulaziz University, Al-Kharj" },
    { q: "What are the tracks?",        a: "6 tracks: Process Automation, Smart Marketing, Intelligent Call Centers, Smart Education, Multi-Agent Systems, Agent-to-Agent (A2A)" },
    { q: "What are the prizes?",        a: "200,000 SAR total prize pool, plus project support, mentorship, and investor connections" },
    { q: "What is Agenticthon?",        a: "A technical hackathon focused on designing and building AI Agent solutions including autonomous agents, multi-agent systems, and intelligent communication protocols between systems" },
    { q: "What is the team size?",      a: "2 to 5 members per team" }
  ]
};

module.exports = { mentors, schedule, venue };
