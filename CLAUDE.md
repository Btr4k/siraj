# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the server

```bash
node server.js          # start on port 3000 (reads .env automatically)
```

No build step, no test suite. Syntax-check a file with `node --check <file>`.

## Architecture

**Siraj** is an AI-powered hackathon management system for *Agenticthon* (7–9 May 2026, Prince Sattam University). It exposes an Express REST API, a web dashboard (`/public`), and a Telegram bot — all backed by an **in-memory state** (no database; restart wipes everything).

### Request flow

```
Telegram / Dashboard / Public web
        ↓
  server.js  (auth, rate-limit, routing)
        ↓
  orchestrator.js  (keyword → agent dispatch)
        ↓
  sub-agent  →  deepseek.js  →  DeepSeek API
        ↓
  data/state.js  (read/write in-memory state)
```

### Agent responsibilities

| File | Role |
|---|---|
| `agents/orchestrator.js` | Keyword-based intent routing (no extra API call). Add new routes to `ROUTES[]`. |
| `agents/guidanceAgent.js` | Schedule, venue, Wi-Fi, parking + personalized lecture recommendations |
| `agents/registrarAgent.js` | Participant lookup, skills, levels |
| `agents/attendanceAgent.js` | Check-in status and attendance stats |
| `agents/matchmakingAgent.js` | Teams and mentor Q&A (read-only) |
| `agents/matchmaker.js` | AI-powered team formation (`formTeams`) and mentor matching (`matchMentor`) |
| `agents/registrar.js` | Operational check-in mutations (`checkInAll`, `detectIssues`, `checkParkingLoad`) |
| `agents/dataManager.js` | NLP admin command parser → executes mutations on state |
| `agents/telegram.js` | Static Telegram menus/callbacks (no AI); dynamic text goes through `orchestrator` |
| `agents/deepseek.js` | Single wrapper for all DeepSeek calls — model set via `DEEPSEEK_MODEL` env var |

### Data layer

- `data/state.js` — singleton in-memory state + all mutation functions (`addAttendee`, `checkinAttendee`, etc.). **Always import mutations from here, not from individual agents.**
- `data/attendees.js` — seed list of participants (replace with real attendees before the event).
- `data/schedule.js` — schedule items (with `type`, `speaker`, `speakerBio`, `relevantSkills`), mentors, and venue info.

### Auth

Admin dashboard uses token-based sessions (`sessions` Map in `server.js`, 8-hour TTL). Public Q&A endpoint `/api/public/ask` is unauthenticated but rate-limited (20 req/min).

## Key rules

- **All AI responses must come from DeepSeek** via `agents/deepseek.js`. Never hardcode answer strings in agents.
- **Event data only lives in `data/`**. Do not embed participant names, schedule, or venue details in agent files.
- **Keyword routing is intentionally free of API calls.** Keep `classifyIntent()` in `orchestrator.js` pure and fast — no async, no AI.
- State is in-memory: mutations in `data/state.js` are the only source of truth at runtime.
