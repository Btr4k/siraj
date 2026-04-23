# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Server

```bash
node server.js          # Start on port 3000 (or $PORT)
```

Requires a `.env` file with:
- `DEEPSEEK_API_KEY` — used by all AI agents
- `TELEGRAM_TOKEN` — for the Telegram webhook bot
- `PORT` (optional, defaults to 3000)

The dashboard is served at `http://localhost:3000` (static file: `public/index.html`).

## Architecture

**Siraj** is a multi-agent hackathon management system for "AI Hackathon Riyadh 2025". It has two interfaces: a web dashboard (`GET /`) and a Telegram bot (`POST /webhook`).

### Agent layer (`agents/`)

All agents that call the AI share a single LLM wrapper:
- `deepseek.js` — thin wrapper around the DeepSeek API (`deepseek-chat` model, 500 token limit)
- `orchestrator.js` — the primary routing agent; handles all inbound messages (Telegram + `/api/simulate-question`). Builds a live context string from `state` and calls DeepSeek with a bilingual system prompt
- `concierge.js` — superseded by orchestrator; not wired into any route in `server.js`
- `matchmaker.js` — forms balanced teams and matches mentors to teams via DeepSeek
- `registrar.js` — pure logic (no LLM): check-in, bulk check-in, parking load calculation, issue detection

### Data layer (`data/`)

All state is **in-memory** (no database). State resets on server restart.

- `attendees.js` — seed array of 20 attendees (name, skill, level, goal, team, checkedIn)
- `schedule.js` — seed data for mentors, schedule slots, venue/halls/FAQ
- `state.js` — mutable singleton that deep-copies seed data at startup; exports `state`, `logActivity`, `addAlert`, `resolveAlert`

To change event info, edit `data/schedule.js` (mentors, schedule, venue, FAQ) and `data/attendees.js`.

### API surface (`server.js`)

| Method | Path | Handler |
|--------|------|---------|
| POST | `/webhook` | Telegram bot — routes message text through `orchestrator.route()` |
| GET | `/api/state` | Returns full state snapshot (stats, log, alerts, teams, attendees, mentors, schedule) |
| POST | `/api/checkin-all` | Randomly checks in ~75% of attendees |
| POST | `/api/form-teams` | Calls matchmaker to form teams via DeepSeek |
| POST | `/api/detect-issues` | Generates alerts based on thresholds |
| POST | `/api/parking` | Calculates parking load and adds alert if >80% |
| POST | `/api/resolve-alert/:id` | Removes alert by id |
| POST | `/api/simulate-question` | Body: `{ question }` — runs through orchestrator, returns `{ answer }` |

The dashboard polls `/api/state` every 3 seconds via `setInterval` — no websockets needed.

### Key design rules

- **All responses must come from DeepSeek** — no hardcoded Arabic/English response strings anywhere
- **Bilingual**: system prompts instruct the LLM to mirror the user's language; never detect language in code
- **No DB migration** — keep in-memory state until explicitly decided otherwise
- **No persistence**: state resets on server restart; seed data reloads from `data/` via `require()`

## Known Issues

1. ngrok is used for the Telegram webhook (temporary) — needs a permanent subdomain + HTTPS via Caddy
2. No process manager — server stops if terminal closes (PM2 needed)
