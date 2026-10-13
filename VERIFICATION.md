# Verification record — October 11, 2026

## Passed

- `npm run typecheck`: no TypeScript errors.
- `npm test`: 3 suites, **39 passing tests**, including two real Socket.IO clients, concurrent submission checks, per-character draft delivery, backspace/clear updates, turn authorization, stale and late drafts, and separate typing rate limits.
- `npm run build`: optimized Next.js 16.4.0 webpack build, TypeScript validation, static page generation, and tracing all completed successfully.
- `npm audit`: **0 known vulnerabilities** after dependency updates; production-only audit also reported 0.
- Frontend and backend HTTP checks returned **200**.
- Production commands `npm start` and `npm run start:server` both started successfully on ports 3000 and 3001.
- Browser home, create, join, host settings, readiness, match start, invalid retry, score synchronization, exact repeat rejection, refresh reconnection, final leaderboard, rarest/highest-scoring highlights, and rematch exercised with two browser tabs.
- Browser example: ocean → bathymetry = 120 (Esoteric), ocean → coral = 35 (Uncommon). Scores matched the leaderboard.
- Browser final-turn example: rain → petrichor = 120, with a rarity reveal on the results screen.
- Responsive home and gameplay inspected at a 390 × 844 viewport; document width matched viewport width, with no horizontal overflow.
- Browser console inspection during the exercised flows returned no errors or warnings.
- 145 prompts; every prompt has at least 16 accepted candidate words for the default eight-player/two-turn setup.

## Interface update verification

- Removed the letter logo, slogans, decorative home cards, ornamental underlines, footer copy, and separate gameplay sidebars. The display name is now Cinnamon.
- Checked the player circle with two players and with eight real connected clients (one browser player and seven simulated Socket.IO clients).
- Verified eight accepted words appearing above their corresponding icons, updated scores below, and active-turn highlighting.
- Inspected the eight-player circle at 390 × 844; all icons and word labels fit within the page width.
- Verified the shorter How to play dialog and retained room creation, readiness, settings, submission, and score display.

## Font, navigation, and live-typing update

- Bundled seven styles from the user-supplied Anthropic Serif archive, approved by the user. Browser computed typography uses Anthropic Serif and the font set reports loaded.
- Added Play / How to play / Settings navigation, colored italic Cinnamon lettering, and original word-card illustrations with labels inheriting the supplied font.
- Removed both requested lobby notices. Scores are enlarged numerals without a suffix in gameplay and results.
- Two browser clients verified `s` → `st` → backspace to `s` appearing above the active player's icon on the other client. A subsequent `arg` draft was visible above the opponent's head before submission and cleared when that turn timed out.
- Completed the same match: sterling (35) + jewelry (35) produced 70 for the first player; metal produced 20 for the second. Drafts did not add points.
- Inspected home, navigation, live drafts, and large scores at a 390 × 844 mobile viewport. No browser errors or warnings were reported during the tested flows.

## Limits of verification

- No Supabase credentials were supplied. A completed-match writer is exercised through dependency injection, but a real Supabase write is not verified.
- External hosting, DNS, service billing, load tests, and a public internet multiplayer session are not configured or verified.
- Docker is unavailable in this environment; the optional Dockerfile has not been built.
- The user supplied and approved Anthropic Serif. Local font loading was verified in the browser; the archive contains Serif rather than Sans.
- Active room state is memory-only. Restarting the game server loses rooms; this was also observed during development restarts.
- Windows sandbox restrictions initially prevented local network tests and Turbopack subprocess work. Final network checks were run with local network access, and the shipped development/build commands select webpack.

This is a functioning classic multiplayer MVP. The conservative offline association bank, conservative spelling and morphology rules, single-instance room storage, and optional database setup are documented in README.md and DEPLOYMENT.md.

## Latest requested changes

- Browser clipboard contained only `6BA82G` after Copy code. Pasting a full HTTPS invite into Join room extracted the six-character code and joined successfully.
- Settings has a persisted colorblind switch; rarity customization and default-description copy are removed. Backdrop clicks and Escape left the dialog open, and X closed it.
- How to play has no example and displays all 145 prompt categories.
- Live drafts have transparent background, zero border, and large lettering. A 32-character draft expanded horizontally within the tested desktop viewport.
- A two-player match began with Bob on cave, then Jamie on pirate. Stalactite and stalagmite each scored 120.
- `treasre` was accepted as treasure for 35; `treasures` was then rejected as a word-family repeat. Buccaneer scored 80; final scores were Bob 200 and Jamie 155.
- `npm run words:check` passed with 145 prompts and 108,563 words. The regenerated bank contains 6,516 lexical relationships.
- New tests cover one-edit correction, ambiguous spellings, verified irregular forms, copied codes/invite links, and rotating round starters with timed-out turns.

## Immersion and accessibility follow-up

- 40 automated tests passed, including autocorrection on/off, physic → physics, correction repeat prevention, and existing multiplayer races.
- Production build passed.
- Colorblind mode now affects the main accent, buttons, lobby/results avatars, gameplay icons, rarity reveals, and point-category rows; numbered players and tier numbers provide non-color cues.
- Central prompts use a single line and length-aware font size.
- Added animated score counters, floating point gains, prompt blur/fades, active-player glow, and urgent-timer pulses. Reduced-motion preferences disable the counters and CSS pulses.
- Word validation failures use “Not found in the word list,” and duplicates use “word is already repeated”.
- Browser toggling changed computed button background from rgb(175, 81, 47) to rgb(0, 114, 178). The How to play dialog displayed all seven tiers and values.
- A two-player browser session verified rainbow stayed on one line (44px height and 44px line height; nowrap), refracton → refraction earned 80, and the counter visibly interpolated through 41 before reaching 80. Browser error/warning logs were empty during this check.

## Expanded associations

- Expanded all 145 prompts to at least 50 separately playable curated answers; verified minimum 60.
- 11,113 curated associations; generated dictionary has 109,219 entries. Rarity remains measured by wordfreq.
- Preserved existing user edits, merged the supplied bank, filtered unsupported additions, and removed obvious unrelated entries.
- `npm run words:check`, TypeScript validation, and all 40 tests passed. The coverage test now validates every curated answer with autocorrection disabled and verifies at least 50 answers can be accepted in sequence without a word-family repeat.

## October 12 finishing touches

- 46 tests passed in five suites, including a two-client socket test for offline-seat expiry, automatic match ending, and token revocation. Engine tests cover active-seat removal, turn skipping, rematch cleanup, reconnection grace, and stale socket protection.
- Repeat tests cover tranquil/tranquility/tranquillity, happy/happiness, and brave/bravery; unrelated coral/corral and universe/university remain distinct.
- Word-bank check passed for all 145 prompts with a minimum of 51 separately playable curated answers.
- Production Next.js build passed and generated `/icon.svg` with the correct metadata convention.
- Browser preview was blocked by the browser security tool. No interactive visual or listening verification is claimed for this update. Sound synthesis is implemented and compiled; manually check the four effects after a browser gesture.
- Changes are prepared locally and have not been pushed to the hosted game in this update.

## October 12 everyday vocabulary expansion

- Added 10 new recognizable prompts and reviewed basic-answer additions for every existing prompt.
- 155 prompts, 14,445 curated associations, 109,230 dictionary entries. Minimum separately playable curated answers: 64.
- Word-bank checks, all 47 tests, and TypeScript validation passed. The new regression test checks obvious answers across all ten new prompts, existing everyday gaps, and unrelated-answer rejection.
- Rebuilt frequency, lexical, morphology, derivational-family, and prompt exports. Changes remain local for review.
