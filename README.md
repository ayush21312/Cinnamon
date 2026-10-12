# Cinnamon

A playable, guest-first multiplayer word association game. Next.js App Router + React + TypeScript + Tailwind CSS, Motion, Lucide, an authoritative Node/Socket.IO server, and optional Supabase match storage.

## Run locally

Use Node.js 22.13+ (Node 24 recommended). From this directory:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

PowerShell users can use `Copy-Item .env.example .env.local` instead of `cp`. Open **http://localhost:3000**. The game server runs at **http://localhost:3001**. No Supabase credentials or Python installation are needed to play: all word data is included.

Create a room, enter a name, and share its six-character code. Join from another tab with a different name, or from another device. Everyone presses **I’m ready**, and the host starts. This is real network multiplayer; each tab has its own guest session.

For two devices on the same network, open `http://YOUR-LAN-IP:3000` on both devices. Set `NEXT_PUBLIC_GAME_SERVER_URL=http://YOUR-LAN-IP:3001` and `CLIENT_ORIGIN=http://YOUR-LAN-IP:3000` in `.env.local`, then restart. Both ports must be reachable through your firewall. A localhost invite works only on the same computer; public friends need a deployed server and frontend.

## Commands

```sh
npm test             # game rules plus real Socket.IO integration tests
npm run typecheck
npm run build        # production Next.js build using webpack
npm start            # production frontend, port 3000
npm run start:server # persistent authoritative game server, port 3001
```

Run the two production commands in separate terminals. Webpack is explicitly selected for predictable Windows builds; Turbopack is not required.

## Implemented

- Private rooms for 2–8 guests, readable codes, copyable invitations, unique names, readiness, and host controls.
- Configurable 5–60 second turns, 1–4 turns per player per prompt, 1–10 prompts, with configurable tier point values in the server settings schema.
- Server-owned deadlines, scores, prompt rotation, no repeats, retrying invalid answers, and final results.
- 145 curated recognizable prompts; an offline 109,219-entry dictionary with real wordfreq Zipf estimates.
- Curated direct and contextual associations plus structural WordNet relationships.
- Same-tab authenticated reconnection, stale socket invalidation, host reassignment, lobby seat expiry, rate limits, strict payload validation, and stale-turn rejection.
- Cream and cinnamon interface, responsive layouts, reduced-motion support, optional synthesized sounds, rarity reveals, score changes, prompt/turn transitions, and results highlights.
- Minimal home screen with Create room, Join room, and How to play. Players use person icons positioned around a circle, with the active player highlighted, current-prompt accepted words above each icon, and scores below.
- Character-by-character live drafts appear above the active player's icon for all connected clients. Drafts are ephemeral, turn-authorized, cleared on turn changes/disconnects, and rate limited separately from game actions. They never award points or enter match history.
- Optional Supabase persistence with a server-only credential and a locked-down migration.

The Settings dialog includes a persistent colorblind mode with blue/orange colors, numbered players, and a dashed active-turn indicator. Rarity-point customization and default-description copy are removed. Dialogs close through X; backdrop clicks and Escape do not dismiss them. How to play lists the seven rarity point categories and their configured scores.

To view and expand the word bank, open [WORD_BANK.md](WORD_BANK.md). Edit `data/associations.json`, then run `npm run words:build`, `npm run words:check`, and `npm test`.

## Project structure

```text
app/                     Next.js home, lobby, gameplay, results, and visual styles
lib/types.ts             public state and protocol types (no secrets)
lib/words.ts             normalization, rarity, replaceable validation interface
server/engine.ts         game rules and state transitions, independent of sockets/UI
server/socket.ts         room registry, identity authorization, events, synchronization
server/persistence.ts    optional idempotent Supabase result writer
server/index.ts          environment configuration and server entry point
data/                    curated associations, dictionary frequencies, lexical relations
scripts/build_words.py   reproducible offline data generation
supabase/migrations/     secure match schema
tests/                   rules, races, timers, scoring, and simulated multiplayer clients
```

## Rules and timing

Each player gets two turns per prompt by default. The starter rotates one seat on each new prompt, including after timed-out turns. A match has three prompts and 15 seconds per turn. Accepted words score immediately and advance the turn; expiration scores zero and advances it. Rejected answers leave the turn and deadline unchanged. All players receive a complete state snapshot after mutations; the browser interpolates the displayed countdown from a server timestamp. Its clock cannot affect acceptance or scores.

The server polls deadlines every 100 ms and also checks the deadline before a submission. At the exact deadline an answer is late. Every turn has a unique token. Even if the same player becomes active again, a request from an earlier turn cannot score. Validation and score mutations are synchronous, so two simultaneous submissions cannot both score.

Normalization uses Unicode NFKC, lowercase, whitespace trimming/collapsing, and curly-apostrophe normalization. Only one word of 2–32 ASCII letters, internal hyphens/apostrophes is supported. Verified plural and noun/verb inflections share a word family: fish/fishes and swim/swam/swimming cannot score separately for the same prompt. Families reset at prompt rotation. The prompt and its forms cannot be played. WordNet verifies roots rather than blindly stripping an s; some ambiguous forms can be conservatively grouped. Unknown spellings of at least four letters are corrected only when exactly one accepted prompt candidate is one edit away. Known English words stay intact except a unique missing/extra final s correction when the original has no verified connection. Accepted base forms determine frequency and points. See [WORD_BANK.md](WORD_BANK.md) for examples and editing instructions.

Disconnected players retain their match seat and score. Their turns continue on the normal deadline and can expire; disconnecting cannot pause the game. In the lobby/results, disconnected seats are removed after two minutes. Entire unoccupied rooms expire after 30 minutes without game activity. The host transfers to the first connected player. Reconnection does not reclaim host status from the new host. Leaving during a match disconnects the seat for that match; the player’s browser clears its resume token.

The per-tab resume token is a random 256-bit bearer secret in `sessionStorage`. It is never broadcast in room state. Display names persist in `localStorage`; there are no accounts or cross-device player statistics. Server restarts lose active rooms and their resume tokens.

## Word intelligence and rarity

See [data/README.md](data/README.md) for methodology, exact thresholds, calibration, provenance, and licenses. `AssociationValidator` is a replaceable interface. The shipped `OfflineValidator` checks:

1. Input shape, word-family repeats, word existence, and conservative spelling correction.
2. Curated relationships (including indirect associations such as fire → phoenix).
3. Precomputed WordNet synonyms, hyponyms up to two levels, parts, and substances.
4. A conservative fallback: recognized but unverifiable associations are rejected with a retry message.

There is no paid AI call and no claim that semantic scores guarantee correctness. This bank can miss creative answers and lexical senses can be broader than a player expects. Unknown frequency never gets the highest tier: it is labeled **Unranked** and receives the Common point value. Relationship reasons are included with accepted submissions; future association-rarity scoring can use separate relationship information rather than altering frequency scoring.

The round deck is shuffled without replacement. Some prompts have a narrower bank than others, especially at eight players or four turns each. Vocabulary/association expansion and playtesting should precede a ranked public launch. Solo, blitz, endless, hybrid scoring, accounts, ranked matchmaking, moderation, and a shared Redis state store are not implemented.

## Supabase (optional)

1. Create a Supabase project.
2. Apply `supabase/migrations/001_matches.sql` using its SQL editor or migration pipeline.
3. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` **on the game server only**. Never prefix this key with `NEXT_PUBLIC_`.
4. Restart the server.

Each completed match is written as one idempotent record containing match settings, match-scoped guest participants and scores, and accepted submissions. This avoids pretending guest sessions are authenticated user accounts. RLS is enabled; anonymous and authenticated frontend roles have no table access. The service role writes the result. There is no public match history page.

Without configuration, the game still works and reports room-only results. A database failure does not interrupt play; the result screen reports the failure. The writer currently makes one attempt and has no durable retry queue. Supabase wiring has integration-tested invocation through an injected writer, but a real database write cannot be verified without credentials.

## Verification

The automated suite covers normalization, existence and associations, exact duplicates, frequency scoring and safe fallback, prompt coverage, room creation/joining/capacity, readiness, host permissions, custom settings, progression, rotation, exact deadline expiration, replay tokens, simultaneous submissions, score totals, rematches, disconnect/reconnect authentication, lobby expiry, rate limits, and two actual network clients.

Browser QA also completed a two-player match: rejected an unrelated English word, accepted bathymetry for ocean for 120 points, refreshed the active second player and restored its seat, rejected a repeated answer, accepted coral for 35 points, verified the leaderboard and rarest/highest-scoring highlights, and returned both clients to the lobby through rematch.

A 390-pixel phone viewport was inspected for home and gameplay with no horizontal overflow. A second match verified that the final accepted answer (rain → petrichor, 120 points) also receives a rarity reveal on the results screen. Browser console inspection found no errors or warnings during these flows. Each prompt has at least 16 accepted candidate words, checked for the default eight-player/two-turn setup; this does not guarantee every player will find them.

## Typography and visual assets

The supplied Anthropic Serif archive is bundled in `public/fonts/`. The user confirmed using Serif rather than Sans. Text styles are used throughout the interface; Display Bold Italic is used for the colored Cinnamon title. Fonts are self-hosted, with no third-party font request. See `public/fonts/README.md` for archive provenance.

The illustrated word cards are original SVG artwork rendered by `app/WordArt.tsx`, with labels that inherit the supplied interface font. The navigation exposes Play, How to play, and Settings. Player scores use large numerals without a points suffix.

The editable project is under this workspace's `outputs/cinammon/`; synced ChatGPT project files under `sources/` are untouched.

## Deployment

Follow [DEPLOYMENT.md](DEPLOYMENT.md). The local game is complete; external hosting and Supabase credentials are not provisioned. Deploy one persistent server instance until room storage moves to Redis or another shared coordinator. The included game engine is separated from transport to make that upgrade practical, but multiple independent server replicas are not supported today.
