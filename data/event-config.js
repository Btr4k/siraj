const eventConfig = {
  type: 'hackathon',        // 'hackathon' | 'conference' | 'exhibition'
  name: 'Agenticthon',
  enabledFeatures: {
    teams: true,
    lectures: false,        // conference-specific
    workshops: true,
    booths: false,          // exhibition-specific
    mentors: true,
    speakers: false
  }
};

module.exports = { eventConfig };
