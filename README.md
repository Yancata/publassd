# 👻 ghost room

a social deduction game where one of the people in the chat... isn't a person.

everyone joins, everyone gets a random mask (alias + avatar). one mask is worn by an AI. you chat, you get suspicious, you DM people, you vote. then the ghost gets unmasked and you get to read what it was *thinking* the whole time.

## how a round goes

- **masks on**: every player (the ghost too) gets renamed to an alias in CometChat
- **chat**: the Warden drops quick questions meant to trip up an AI. DM anyone to form alliances
- **the ghost** reads the room, types with delays and typos, defends itself, and sometimes slides into your DMs
- **vote**: spotlight, card flip, unmask. did you get it?

2–6 humans + 1 ghost. works great with phones on the same wifi.

## running it

you need node 20+ and a CometChat app.

```bash
npm install
cp .env.example .env    # then fill it in
npm run dev             # http://localhost:5173
```

what goes in `.env`:
- your CometChat **app id, region, auth key** (or run `npx @cometchat/skills-cli provision run` here and skip those)
- your CometChat **REST API key** (dashboard → API & Auth Keys). server-side only, the bots post with it
- an **LLM key** if you want a smart ghost. openai / anthropic / gemini get auto-detected. no key = offline fallback ghost (dumber, still fun)

open 3+ tabs, put a name in each, hit start. set `GAME_PACE=demo` for short timers.

## stack

vite + react 19 + CometChat react UI kit v7. the game server is just a vite plugin: keeps state, streams it over SSE, and posts the Ghost/Warden messages through the CometChat REST API (`onBehalfOf`), so bots look exactly like normal users.

each tab logs in separately (`StorageMode.SESSION`), so you can play 4 seats on one laptop.

built with the CometChat MCP (see `.cursor/mcp.json`).
