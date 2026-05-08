const mentors = [
  { id: 1, name: "د. أحمد الفارسي",  specialty: "NLP & Machine Learning", available: true,  team: null },
  { id: 2, name: "أ. نورة السبيعي",  specialty: "Product & UX",           available: true,  team: null },
  { id: 3, name: "أ. خالد الزهراني", specialty: "Cloud & DevOps",         available: false, team: 3   },
  { id: 4, name: "د. سارة العمري",   specialty: "Business & Startups",    available: true,  team: null },
  { id: 5, name: "د. محمد الدوسري",  specialty: "Data Science & AI",      available: false, team: 1   }
];

const ALL_SKILLS = ["AI Engineer","Backend Dev","Frontend Dev","Data Scientist","UX Designer","Product Manager","DevOps","Business Dev"];

const schedule = [
  // ── اليوم الأول — 7 مايو 2026 — ONBOARDING · FOUNDATIONS ──
  {
    day: 1, time: "10:00", title: "وصول الفرق والتسجيل", hall: "المدخل الرئيسي", duration: 180,
    type: "logistics", speaker: null, speakerBio: null, relevantSkills: []
  },
  {
    day: 1, time: "13:00", title: "حفل الافتتاح والكلمات الترحيبية", hall: "الصالة الرياضية", duration: 60,
    type: "ceremony", speaker: "قيادة الجامعة والرعاة",
    speakerBio: "كلمة ترحيب من رئيس الجامعة وشركاء الهاكاثون بيوند لتقنية المعلومات.",
    relevantSkills: []
  },
  {
    day: 1, time: "14:00", title: "عرض تعريفي بمحاور الهاكاثون", hall: "الصالة الرياضية", duration: 120,
    type: "presentation", speaker: "فريق التنظيم",
    speakerBio: "نظرة عامة على المسارات الستة وآليات التحكيم وقواعد المشاركة.",
    relevantSkills: ALL_SKILLS
  },
  {
    day: 1, time: "16:00", title: "ورشة العمل الأولى", hall: "قاعات العمل", duration: 60,
    type: "development", speaker: null, speakerBio: null, relevantSkills: ALL_SKILLS
  },
  {
    day: 1, time: "17:00", title: "ورشة العمل الثانية", hall: "قاعات العمل", duration: 60,
    type: "development", speaker: null, speakerBio: null, relevantSkills: ALL_SKILLS
  },
  {
    day: 1, time: "18:00", title: "ورشة العمل الثالثة", hall: "قاعات العمل", duration: 60,
    type: "development", speaker: null, speakerBio: null, relevantSkills: ALL_SKILLS
  },
  {
    day: 1, time: "19:00", title: "ورشة العمل الرابعة", hall: "قاعات العمل", duration: 60,
    type: "development", speaker: null, speakerBio: null, relevantSkills: ALL_SKILLS
  },
  {
    day: 1, time: "20:00", title: "انتهاء اليوم الأول", hall: "الصالة الرياضية", duration: 0,
    type: "logistics", speaker: null, speakerBio: null, relevantSkills: []
  },

  // ── اليوم الثاني — 8 مايو 2026 — DEEP WORK · MENTORSHIP ──
  {
    day: 2, time: "13:00", title: "بدء العمل على المشاريع", hall: "قاعات العمل", duration: 60,
    type: "development", speaker: null, speakerBio: null, relevantSkills: ALL_SKILLS
  },
  {
    day: 2, time: "14:00", title: "ورشة العمل الأولى", hall: "قاعات العمل", duration: 120,
    type: "development", speaker: null, speakerBio: null, relevantSkills: ALL_SKILLS
  },
  {
    day: 2, time: "16:00", title: "ورشة العمل الثانية", hall: "قاعات العمل", duration: 60,
    type: "development", speaker: null, speakerBio: null, relevantSkills: ALL_SKILLS
  },
  {
    day: 2, time: "17:00", title: "ورشة العمل الثالثة", hall: "قاعات العمل", duration: 60,
    type: "development", speaker: null, speakerBio: null, relevantSkills: ALL_SKILLS
  },
  {
    day: 2, time: "18:00", title: "ورشة العمل الرابعة", hall: "قاعات العمل", duration: 60,
    type: "development", speaker: null, speakerBio: null, relevantSkills: ALL_SKILLS
  },
  {
    day: 2, time: "19:00", title: "اعرض فكرتك", hall: "الصالة الرياضية", duration: 60,
    type: "presentation", speaker: "الفرق المشاركة",
    speakerBio: "عروض قصيرة للأفكار الأولية أمام المرشدين والفرق الأخرى للحصول على تغذية راجعة.",
    relevantSkills: ALL_SKILLS
  },
  {
    day: 2, time: "20:00", title: "انتهاء اليوم الثاني", hall: "الصالة الرياضية", duration: 0,
    type: "logistics", speaker: null, speakerBio: null, relevantSkills: []
  },

  // ── اليوم الثالث — 9 مايو 2026 — PITCH · JUDGING · AWARDS ──
  {
    day: 3, time: "08:00", title: "آخر فرصة لتسليم الأعمال", hall: "قاعات العمل", duration: 120,
    type: "logistics", speaker: null, speakerBio: null, relevantSkills: ALL_SKILLS
  },
  {
    day: 3, time: "10:00", title: "بدء التقييم من لجنة التحكيم", hall: "الصالة الرياضية", duration: 300,
    type: "presentation", speaker: "لجنة التحكيم",
    speakerBio: "لجنة من خبراء الصناعة والأكاديميين تقيّم المشاريع على أساس الابتكار والتنفيذ والأثر.",
    relevantSkills: ALL_SKILLS
  },
  {
    day: 3, time: "15:00", title: "انتهاء التقييم", hall: "الصالة الرياضية", duration: 0,
    type: "logistics", speaker: null, speakerBio: null, relevantSkills: []
  },
  {
    day: 3, time: "19:00", title: "حفل الختام وتكريم الفائزين", hall: "الصالة الرياضية", duration: 90,
    type: "ceremony", speaker: "قيادة الجامعة وشركاء الهاكاثون",
    speakerBio: "إعلان الفائزين وتوزيع الجوائز والشهادات وجوائز بإجمالي 200,000 ريال.",
    relevantSkills: []
  }
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
