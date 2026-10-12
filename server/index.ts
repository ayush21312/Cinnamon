import dotenv from 'dotenv';
import { createGameServer } from './socket';
import { resultStore } from './persistence';
dotenv.config({ path: '.env.local' });
dotenv.config();
const port = Number(process.env.PORT ?? 3001);
const app = createGameServer({
  origin: (process.env.CLIENT_ORIGIN ?? 'http://localhost:3000').split(',').map((v) => v.trim()),
  saveResult: resultStore(),
});
app.http.listen(port, '0.0.0.0', () =>
  console.log(`Cinammon game server: http://localhost:${port}`),
);
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => void app.close().then(() => process.exit(0)));
