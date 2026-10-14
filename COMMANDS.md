# Cinnamon commands

Run these commands in the `cinammon` project folder in VS Code's terminal. Use Node.js 22.13+ and npm. Stop a running development server with **Ctrl+C**.

## First setup (PowerShell)

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Copy the environment file only during initial setup; do not overwrite a configured `.env.local`. Open http://localhost:3000. `npm run dev` runs both the website (3000) and multiplayer server (3001). Configure `NEXT_PUBLIC_GAME_SERVER_URL` and `CLIENT_ORIGIN` for public or LAN use; see DEPLOYMENT.md. Keep private keys out of Git and frontend environment variables.

## Run the game

| Command                | Purpose                                                             |
| ---------------------- | ------------------------------------------------------------------- |
| `npm run dev`          | Run website and game server together with development reloads.      |
| `npm run dev:web`      | Run only the development website.                                   |
| `npm run dev:server`   | Run only the development multiplayer server.                        |
| `npm run server`       | Alias for the development game server.                              |
| `npm run build`        | Compile a production website.                                       |
| `npm start`            | Run the compiled website; run build first.                          |
| `npm run start:server` | Run the persistent multiplayer server without development watching. |

For production locally, use two terminals: `npm run build` then `npm start` in the first, and `npm run start:server` in the second. The frontend needs the correct game-server URL at build time. Do not run two servers on the same port.

## Tests and checks

```powershell
npm test
npm run typecheck
npm run words:check
npm run build
```

`npm test` includes real simulated Socket.IO clients for room, turn, chat and reconnection behavior. To run one suite:

```powershell
npm test -- tests/multiplayer.test.ts
npm test -- tests/sounds.test.ts
```

To inspect all command names, run `npm run`. For whitespace checks, run `git diff --check`. To format a particular file, use `npx prettier --write app/page.tsx` (replace the path with the file you changed).

## Add words manually

Edit `data/associations.json`. Find the prompt and append lowercase, genuine related English words to the existing space-separated string; preserve existing answers and valid JSON. Plurals, tenses and verified derived families cannot count separately. New prompts need at least 50 separately playable curated answer families.

Install Python data-building dependencies once:

```powershell
python -m pip install wordfreq==3.1.1 nltk==3.9.2
```

After editing the bank:

```powershell
npm run words:build
npm run words:check
npm run words:stats
npm test
```

`words:build` regenerates dictionary, rarity, morphology and prompt exports. Do not edit generated files directly. WordNet downloads on the first build, so internet access is required then. `words:stats` lists every prompt's counts and writes `work/word-bank-counts.csv`. Restart development after regeneration if the server is still using old data. See WORD_BANK.md for scoring and review details.

## Datamuse expansion

```powershell
npm run words:fetch
# Or selected existing prompts only:
npm run words:fetch -- ocean forest pizza
```

Review `work/datamuse-review.json`, marking `approved: true` only for meaningful connections. Suggestions are not automatically accepted or scored. Cached API responses are stored under `work/datamuse-cache/`. A fresh fetch replaces the review file, so finish the review first. Configure `DATAMUSE_API_KEY` in `.env.local` when required by the provider; never prefix it with NEXT_PUBLIC.

```powershell
npm run words:merge
npm run words:build
npm run words:check
npm test
```

## Save and deploy changes

Review what will be included:

```powershell
git status
git diff
```

After the tests/checks pass:

```powershell
git add .
git diff --cached --stat
git commit -m "Describe your changes"
git push origin main
```

Push from the project repository, not the parent ChatGPT workspace. Check the staged files before committing; `.env.local`, dependencies and scratch `work/` files are ignored. Vercel and Render deploy automatically if their Git auto-deploy settings are enabled. Otherwise deploy the latest commit from the provider dashboard. Check Vercel's Ready and Render's Live status, then refresh the website. Backend deployments restart the server and close in-memory rooms, so deploy between play sessions. Neither chat nor active matches survive a server restart.

## Get changes made elsewhere

With a clean working tree:

```powershell
git pull --ff-only origin main
```

If package files changed, run `npm ci`, then run the appropriate tests and restart development. Commit or safely preserve local changes before pulling. Do not use reset/clean commands to discard changes unless you intend to delete them.

## Common fixes

- **Connecting to game server:** run `npm run dev` (both services) and verify the configured URL and allowed frontend origin. A frontend-only start does not run multiplayer.
- **Port already in use:** stop your previous server with Ctrl+C; do not start another copy.
- **Missing Python module:** install the pinned Python dependencies above using the same Python interpreter used by `words:build`.
- **A word is rejected:** check its prompt relationship, spelling and repeat family; add a reviewed missing association, then rebuild/check.
- **Contact placeholder:** set `CONTACT_EMAIL` on the frontend host and redeploy. This is a public email address.
- **Site did not update:** inspect the deployment logs and confirm both hosts deployed the intended commit. Frontend public environment changes need a new build.
