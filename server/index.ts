import dotenv from 'dotenv';
import { createGameServer } from './socket';
import { resultStore } from './persistence';
import { gameOrigins } from './origins';
dotenv.config({ path: '.env.local' });
dotenv.config();
const port = Number(process.env.PORT ?? 3001);
const app = createGameServer({
  origin: gameOrigins(process.env.CLIENT_ORIGIN),
  saveResult: resultStore(),
});
app.http.listen(port, '0.0.0.0', () =>
  console.log(`Cinammon game server: http://localhost:${port}`),
);
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => void app.close().then(() => process.exit(0)));
