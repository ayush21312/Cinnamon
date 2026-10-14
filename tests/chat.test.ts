import { afterEach, describe, expect, it } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { createGameServer } from '../server/socket';
import type { ChatMessage, Reply } from '../lib/types';
const servers: ReturnType<typeof createGameServer>[] = [];
const clients: Socket[] = [];
afterEach(async () => {
  clients.splice(0).forEach((s) => s.disconnect());
  await Promise.all(servers.splice(0).map((s) => s.close()));
});
function request(socket: Socket, event: string, payload: unknown = {}): Promise<Reply> {
  return new Promise((resolve, reject) =>
    socket
      .timeout(2500)
      .emit(event, payload, (err: Error | null, reply: Reply) =>
        err ? reject(err) : resolve(reply),
      ),
  );
}
async function setup() {
  let now = 1000;
  const server = createGameServer({ now: () => now, tickMs: 60_000 });
  servers.push(server);
  await new Promise<void>((resolve) => server.http.listen(0, '127.0.0.1', resolve));
  const address = server.http.address();
  if (!address || typeof address === 'string') throw Error('No port');
  const url = `http://127.0.0.1:${address.port}`;
  async function connect() {
    const socket = io(url, {
      autoConnect: false,
      reconnection: false,
      transports: ['websocket'],
    });
    clients.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
      socket.connect();
    });
    return socket;
  }
  const a = await connect(),
    b = await connect();
  const created = await request(a, 'create', { name: 'Ada' });
  const joined = await request(b, 'join', { name: 'Ben', code: created.code });
  return {
    server,
    a,
    b,
    created,
    joined,
    connect,
    advance: () => {
      now += 10_001;
    },
  };
}
describe('room chat with real clients', () => {
  it('broadcasts only to its room during another player’s turn without changing scores or turns', async () => {
    const { server, a, b, created, connect } = await setup();
    const outsider = await connect();
    expect((await request(outsider, 'chat:send', { text: 'hi' })).ok).toBe(false);
    expect((await request(outsider, 'chat:history')).ok).toBe(false);
    await request(outsider, 'create', { name: 'Elsewhere' });
    const leaked: ChatMessage[] = [];
    outsider.on('chat:message', (m) => leaked.push(m));
    await request(a, 'ready', true);
    await request(b, 'ready', true);
    await request(a, 'start');
    const room = server.rooms.get(created.code!)!,
      before = structuredClone(room.state);
    const received = new Promise<ChatMessage>((resolve) => a.once('chat:message', resolve));
    expect((await request(b, 'chat:send', { text: '  Hello\nroom!  ' })).ok).toBe(true);
    expect(await received).toMatchObject({ name: 'Ben', text: 'Hello room!' });
    expect(room.state.turnId).toBe(before.turnId);
    expect(room.state.history).toEqual(before.history);
    expect(room.state.players.map((p) => p.score)).toEqual(before.players.map((p) => p.score));
    expect((await request(outsider, 'chat:history')).messages).toEqual([]);
    expect(leaked).toEqual([]);
    expect(JSON.stringify(room.snapshot())).not.toContain('Hello room!');
  });
  it('rejects blank/oversized/forged messages, limits spam, and restores bounded history on reconnect', async () => {
    const { a, b, created, joined, advance, connect } = await setup();
    for (const payload of [
      { text: ' ' },
      { text: 'x'.repeat(201) },
      { text: 'hi', name: 'Ada' },
      { text: 'hi', playerId: created.playerId },
    ])
      expect((await request(b, 'chat:send', payload)).ok).toBe(false);
    for (let i = 0; i < 5; i++)
      expect((await request(b, 'chat:send', { text: `Message ${i}` })).ok).toBe(true);
    expect((await request(b, 'chat:send', { text: 'too soon' })).ok).toBe(false);
    b.disconnect();
    const resumed = await connect();
    expect(
      (
        await request(resumed, 'resume', {
          code: created.code,
          playerId: joined.playerId,
          token: joined.token,
        })
      ).ok,
    ).toBe(true);
    // Reconnecting must not reset the send limit.
    expect((await request(resumed, 'chat:send', { text: 'still too soon' })).ok).toBe(false);
    for (let batch = 1; batch < 11; batch++) {
      advance();
      for (let i = 0; i < 5; i++)
        expect((await request(resumed, 'chat:send', { text: `Message ${batch * 5 + i}` })).ok).toBe(
          true,
        );
    }
    const history = (await request(a, 'chat:history')).messages!;
    expect(history).toHaveLength(50);
    expect(history[0].text).toBe('Message 5');
    expect(history.at(-1)?.text).toBe('Message 54');
    expect(new Set(history.map((m) => m.id)).size).toBe(50);
  });
  it('rejects messages after leaving and ignores attempts to supply a target room', async () => {
    const { a, b, created } = await setup();
    expect((await request(b, 'chat:send', { text: 'hello', code: created.code })).ok).toBe(false);
    expect((await request(b, 'leave')).ok).toBe(true);
    expect((await request(b, 'chat:send', { text: 'bye' })).ok).toBe(false);
    expect((await request(a, 'chat:history')).messages).toEqual([]);
  });
});
