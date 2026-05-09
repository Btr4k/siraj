const path = require('path');
const fs   = require('fs');

const PROFILES_FILE = path.join(__dirname, 'profiles.json');

// Keyed by Telegram chatId (string)
// Schema: { name, role, interests[], goal, language, attendedSessions[], connectionsMade[], attendeeId, createdAt }
const profiles = new Map();

function getOrCreateProfile(chatId) {
  const key = String(chatId);
  if (!profiles.has(key)) {
    profiles.set(key, {
      name:             null,
      role:             null,   // 'attendee' | 'organizer' | 'speaker'
      interests:        [],     // ['AI Agents','Security','NLP',...]
      goal:             null,   // 'learn'|'build'|'network'|'hire'|'get hired'
      language:         'ar',
      attendedSessions: [],
      connectionsMade:  [],
      attendeeId:       null,
      createdAt:        new Date().toISOString()
    });
  }
  return profiles.get(key);
}

function updateProfile(chatId, fields) {
  const key = String(chatId);
  const existing = getOrCreateProfile(key);
  Object.assign(existing, fields);
  return existing;
}

function persistProfiles() {
  try {
    const obj = {};
    for (const [k, v] of profiles.entries()) obj[k] = v;
    fs.writeFileSync(PROFILES_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch (e) {
    console.error('profiles persist error:', e.message);
  }
}

function loadProfiles() {
  try {
    if (!fs.existsSync(PROFILES_FILE)) return;
    const obj = JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf8'));
    for (const [k, v] of Object.entries(obj)) profiles.set(k, v);
    console.log(`✅ Loaded ${profiles.size} user profiles`);
  } catch (e) {
    console.error('profiles load error:', e.message);
  }
}

setInterval(persistProfiles, 60000);

module.exports = { profiles, getOrCreateProfile, updateProfile, persistProfiles, loadProfiles };
