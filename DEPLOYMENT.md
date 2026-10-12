# Deploy Cinammon

The frontend and authoritative server are independent processes. The server needs a long-lived Node environment and one shared room registry. Do not put the current in-memory Socket.IO engine into an ordinary short-lived serverless handler. Sites hosting uses Cloudflare Workers; this Node server would require an explicit Durable Objects redesign to host there.

## Recommended student setup

### 1. Persistent game server (Render or equivalent Node host)

Push this directory to a Git repository. Create a Node web service:

- Build command: `npm ci`
- Start command: `npm run start:server`
- Health check: `/` (returns JSON)
- Environment: `CLIENT_ORIGIN=https://YOUR-FRONTEND-DOMAIN`
- Optional environment: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` as server secrets
- Let the provider supply `PORT`; the server binds `0.0.0.0`.
- Run exactly **one instance** with no autoscaling. Allow WebSocket upgrades and Socket.IO HTTP polling. TLS should terminate at the host.

Record the resulting HTTPS server URL. Avoid a trailing slash in origins. For multiple deliberate frontend origins, `CLIENT_ORIGIN` is a comma-separated list. The server checks browser Origin during connection and permits origin-less nonbrowser clients; Origin is not authentication. Guest seat authorization is the resume token/socket identity.

Alternatively, build the supplied server container with `docker build -f Dockerfile.server -t cinammon-server .` and run it with `docker run --env-file .env.local -p 3001:3001 cinammon-server`. This container includes the runtime TypeScript loader and offline data. The Docker image definition is supplied but Docker was not available for an image-build verification in this session.

### 2. Next.js frontend (Vercel or equivalent)

- Import the repository and select the Next.js framework.
- Root directory: directory containing this `package.json`.
- Install command: `npm ci`
- Build command: `npm run build`
- Set `NEXT_PUBLIC_GAME_SERVER_URL=https://YOUR-GAME-SERVER-DOMAIN` **before building**.
- Deploy, then set `CLIENT_ORIGIN` on the game server to this exact frontend origin and restart the server.
- Test two devices: create, join, ready, start, submit, refresh an active player, and finish a match.

The frontend can run on Vercel because it only connects to the separately hosted server. Even where Vercel offers WebSocket features, adopting them requires explicit validation of the lifecycle/state guarantees; this app does not rely on them.

### 3. Optional Supabase

Apply the migration in `supabase/migrations/001_matches.sql`. Configure its URL and service role only on the game server. Confirm the result screen says **Match saved** and inspect the `matches` row. Test a failed connection too; gameplay should still finish. Do not grant anonymous table writes or embed privileged keys in Next.js public variables.

### 4. Domain

After the two-device smoke test, add a frontend domain such as `cinammon.gg` in your frontend host. Configure its DNS records as directed by that host. Put the server at a subdomain such as `play.cinammon.gg`, update the public server URL and origin allowlist, and redeploy/restart. Domain purchase and DNS configuration are external tasks and have not been performed.

## Free tiers and costs

Checked against provider documentation on October 11, 2026; quotas and policies can change.

- **Local development:** no hosting charge, no paid AI or dictionary API.
- **Vercel Hobby:** a free plan with usage limits and personal/noncommercial restrictions; a public game with commercial use may need a paid plan. [Hobby documentation](https://vercel.com/docs/plans/hobby).
- **Render Free web service:** an actual free option subject to quotas, cold starts, and spin-down after 15 minutes without inbound HTTP or WebSocket activity. Restart/spin-down destroys in-memory rooms. A paid persistent instance is a practical upgrade for dependable sessions. [Free service documentation](https://render.com/docs/free), [WebSocket documentation](https://render.com/docs/websocket).
- **Supabase Free:** includes a limited database allocation (currently 500 MB); inactive free projects can pause. Paid plans and overages apply beyond limits. [Billing documentation](https://supabase.com/docs/guides/platform/billing-on-supabase), [project pausing](https://supabase.com/docs/guides/platform/free-project-pausing).
- **Domain:** a purchased domain has separate recurring registrar costs. No subscription, domain, or paid service was created for this project.

## Reliability limits and next steps

Active rooms are memory-only and cannot survive a process restart, sleep, or deploy. Supabase keeps completed results only; it is not the live game coordinator. Match writes are idempotent but have no durable retry queue. Connection errors are shown and guest seats can reconnect while the original room exists.

Before scaling to multiple server instances, add a shared authoritative room store/coordinator, Socket.IO adapter, sticky routing for polling, distributed rate limits, and atomic turn mutations. Before a large public launch, add connection-level abuse limits, moderation, broader association coverage, load tests, observability, persistence retries, privacy/retention controls, and mobile/assistive-technology playtesting. This delivery is a working classic multiplayer MVP, not a completed ranked production service.
