import { describe, it, expect, afterEach } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { createGameServer } from '../server/socket';
import type { Reply, RoomState, TypingUpdate } from '../lib/types';
import { defaultSettings } from '../server/engine';
import associations from '../data/associations.json';
import { OfflineValidator } from '../lib/words';
const servers: ReturnType<typeof createGameServer>[] = [];
const clients: Socket[] = [];
afterEach(async () => {
  clients.splice(0).forEach((s) => s.disconnect());
  await Promise.all(servers.splice(0).map((s) => s.close()));
});
async function setup(saveResult?: (s: RoomState) => Promise<void>) {
  const server = createGameServer({ saveResult });
  servers.push(server);
  await new Promise<void>((resolve) => server.http.listen(0, '127.0.0.1', resolve));
  const addr = server.http.address();
  if (!addr || typeof addr === 'string') throw Error('Missing port');
  const url = `http://127.0.0.1:${addr.port}`;
  return { server, url };
}
async function client(url: string) {
  const s = io(url, { autoConnect: false, reconnection: false, transports: ['websocket'] });
  clients.push(s);
  await new Promise<void>((resolve, reject) => {
    s.once('connect', resolve);
    s.once('connect_error', reject);
    s.connect();
  });
  return s;
}
function request(s: Socket, event: string, payload: unknown = {}): Promise<Reply> {
  return new Promise((resolve, reject) =>
    s
      .timeout(2500)
      .emit(event, payload, (error: Error | null, reply: Reply) =>
        error ? reject(error) : resolve(reply),
      ),
  );
}
function stateNext(s: Socket, predicate: (s: RoomState) => boolean): Promise<RoomState> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      s.off('state', listener);
      reject(Error('State timeout'));
    }, 3000);
    function listener(state: RoomState) {
      if (predicate(state)) {
        clearTimeout(timer);
        s.off('state', listener);
        resolve(state);
      }
    }
    s.on('state', listener);
  });
}
describe('two actual Socket.IO clients', () => {
  it('broadcasts a new turn immediately when a late typing packet expires the old turn', async () => {
    let now = 1000;
    const server = createGameServer({ now: () => now, tickMs: 60_000 });
    servers.push(server);
    await new Promise<void>((resolve) => server.http.listen(0, '127.0.0.1', resolve));
    const addr = server.http.address();
    if (!addr || typeof addr === 'string') throw Error('Missing port');
    const url = `http://127.0.0.1:${addr.port}`,
      a = await client(url),
      b = await client(url);
    const created = await request(a, 'create', { name: 'Ada' }),
      joined = await request(b, 'join', { name: 'Ben', code: created.code });
    await request(a, 'ready', true);
    await request(b, 'ready', true);
    await request(a, 'start');
    const room = server.rooms.get(created.code!)!,
      turnId = room.state.turnId;
    const advanced = stateNext(b, (s) => s.activeId === joined.playerId);
    now = room.state.deadline;
    expect((await request(a, 'typing', { word: 'late', turnId })).ok).toBe(false);
    expect((await advanced).typing).toBeNull();
    expect(room.state.players[0].score).toBe(0);
  });
  it('streams every draft edit to another client without allowing identity or score forgery', async () => {
    const { server, url } = await setup();
    const a = await client(url),
      b = await client(url);
    const created = await request(a, 'create', { name: 'Ada' });
    const joined = await request(b, 'join', { name: 'Ben', code: created.code });
    await request(a, 'ready', true);
    await request(b, 'ready', true);
    await request(a, 'start');
    const room = server.rooms.get(created.code!)!;
    const turnId = room.state.turnId,
      deadline = room.state.deadline;
    const received: TypingUpdate[] = [];
    b.on('typing', (draft) => received.push(draft));
    for (const word of ['c', 'co', 'cor', 'co', '']) {
      const broadcast = new Promise<TypingUpdate>((resolve) => b.once('typing', resolve));
      expect((await request(a, 'typing', { word, turnId })).ok).toBe(true);
      expect(await broadcast).toEqual({ playerId: created.playerId, turnId, word });
    }
    expect(received.map((d) => d.word)).toEqual(['c', 'co', 'cor', 'co', '']);
    expect(room.state.history).toHaveLength(0);
    expect(room.state.deadline).toBe(deadline);
    expect(room.state.players.every((p) => p.score === 0)).toBe(true);
    expect((await request(b, 'typing', { word: 'fake', turnId })).ok).toBe(false);
    expect(
      (await request(a, 'typing', { word: 'forged', turnId, playerId: joined.playerId })).ok,
    ).toBe(false);
    expect((await request(a, 'typing', { word: 'x'.repeat(33), turnId })).ok).toBe(false);
    expect((await request(a, 'typing', { word: '<script>', turnId })).ok).toBe(false);
    const answer = (associations as Record<string, string>)[room.state.prompt].split(' ')[0];
    await request(a, 'submit', { word: answer, turnId });
    expect(room.state.typing).toBeNull();
    expect((await request(a, 'typing', { word: 'old', turnId })).ok).toBe(false);
    expect(received).toHaveLength(5);
  });
  it('rate limits typing separately so normal drafts do not block submissions', async () => {
    const { server, url } = await setup();
    const a = await client(url),
      b = await client(url);
    const created = await request(a, 'create', { name: 'Ada' });
    await request(b, 'join', { name: 'Ben', code: created.code });
    await request(a, 'ready', true);
    await request(b, 'ready', true);
    await request(a, 'start');
    const room = server.rooms.get(created.code!)!,
      turnId = room.state.turnId;
    const replies = await Promise.all(
      Array.from({ length: 35 }, () => request(a, 'typing', { word: 'c', turnId })),
    );
    expect(replies.some((r) => !r.ok && r.error === 'Typing too quickly.')).toBe(true);
    const word = (associations as Record<string, string>)[room.state.prompt].split(' ')[0];
    expect((await request(a, 'submit', { word, turnId })).ok).toBe(true);
  });
  it('creates, joins, readies, synchronizes scores, rejects unauthorized turns, and finishes', async () => {
    const saved: RoomState[] = [];
    const { server, url } = await setup(async (s) => {
      saved.push(s);
    });
    const a = await client(url),
      b = await client(url);
    const created = await request(a, 'create', { name: 'Ada' });
    expect(created.ok).toBe(true);
    expect((await request(b, 'join', { name: 'Ben', code: 'ZZZZZZ' })).ok).toBe(false);
    const joined = await request(b, 'join', { name: 'Ben', code: created.code });
    expect(joined.ok).toBe(true);
    expect((await request(b, 'settings', defaultSettings)).ok).toBe(false);
    await request(a, 'settings', { ...defaultSettings, rounds: 1, turnsPerPrompt: 1 });
    await request(a, 'ready', true);
    await request(b, 'ready', true);
    const started = stateNext(b, (s) => s.phase === 'playing');
    expect((await request(a, 'start')).ok).toBe(true);
    const state = await started;
    const room = server.rooms.get(created.code!)!;
    const words = (associations as Record<string, string>)[state.prompt]
      .split(' ')
      .filter((word) => new OfflineValidator().validate(state.prompt, word, []).valid);
    expect((await request(b, 'submit', { word: words[0], turnId: state.turnId })).ok).toBe(false);
    // Unknown fields cannot forge the active identity or change points.
    expect(
      (
        await request(b, 'submit', {
          word: words[0],
          turnId: state.turnId,
          playerId: created.playerId,
          score: 9999,
        })
      ).ok,
    ).toBe(false);
    expect(
      (await request(a, 'submit', { word: words[0], turnId: state.turnId, score: 9999 })).ok,
    ).toBe(false);
    expect(room.state.players.every((player) => player.score === 0)).toBe(true);
    expect((await request(a, 'submit', { word: 'zzqqqqq', turnId: state.turnId })).ok).toBe(false);
    const sync = stateNext(b, (s) => s.history.length === 1);
    const [first, duplicate] = await Promise.all([
      request(a, 'submit', { word: words[0], turnId: state.turnId }),
      request(a, 'submit', { word: words[1], turnId: state.turnId }),
    ]);
    expect(first.ok).toBe(true);
    expect(duplicate.ok).toBe(false);
    const updated = await sync;
    expect(updated.activeId).toBe(joined.playerId);
    expect(updated.history).toHaveLength(1);
    expect(updated.players[0].score).toBeGreaterThan(0);
    expect(
      (await request(b, 'submit', { word: words[0].toUpperCase(), turnId: updated.turnId })).ok,
    ).toBe(false);
    const results = stateNext(a, (s) => s.phase === 'results');
    expect((await request(b, 'submit', { word: words[1], turnId: updated.turnId })).ok).toBe(true);
    const final = await results;
    expect(final.history).toHaveLength(2);
    expect(final.players.reduce((sum, p) => sum + p.score, 0)).toBe(
      final.history.reduce((sum, s) => sum + s.points, 0),
    );
    expect(saved).toHaveLength(1);
    expect(room.state.persistence).toBe('saved');
  });
  it('reassigns host and restores the same seat using a private token', async () => {
    const { url } = await setup();
    const a = await client(url),
      b = await client(url);
    const created = await request(a, 'create', { name: 'Ada' });
    const joined = await request(b, 'join', { name: 'Ben', code: created.code });
    const disconnected = stateNext(
      b,
      (s) => s.hostId === joined.playerId && !s.players[0].connected,
    );
    a.disconnect();
    await disconnected;
    const reconnect = await client(url);
    expect(
      (
        await request(reconnect, 'resume', {
          code: created.code,
          playerId: created.playerId,
          token: 'f'.repeat(64),
        })
      ).ok,
    ).toBe(false);
    const restored = stateNext(b, (s) => s.players[0].connected);
    expect(
      (
        await request(reconnect, 'resume', {
          code: created.code,
          playerId: created.playerId,
          token: created.token,
        })
      ).ok,
    ).toBe(true);
    const state = await restored;
    expect(state.players).toHaveLength(2);
    expect(state.hostId).toBe(joined.playerId);
    expect(JSON.stringify(state)).not.toContain(created.token);
  });
  it('ticks the timer on the server without browser cooperation', async () => {
    let now = 1000;
    const server = createGameServer({ now: () => now, tickMs: 10 });
    servers.push(server);
    await new Promise<void>((resolve) => server.http.listen(0, '127.0.0.1', resolve));
    const addr = server.http.address();
    if (!addr || typeof addr === 'string') throw Error();
    const url = `http://127.0.0.1:${addr.port}`;
    const a = await client(url),
      b = await client(url);
    const created = await request(a, 'create', { name: 'Ada' });
    const joined = await request(b, 'join', { name: 'Ben', code: created.code });
    await request(a, 'ready', true);
    await request(b, 'ready', true);
    await request(a, 'start');
    const room = server.rooms.get(created.code!)!;
    const advanced = stateNext(b, (s) => s.activeId === joined.playerId);
    now = room.state.deadline;
    const state = await advanced;
    expect(state.turn).toBe(1);
    expect(state.players[0].score).toBe(0);
  });
  it('rate limits repeated requests', async () => {
    const { url } = await setup();
    const a = await client(url);
    const replies = await Promise.all(
      Array.from({ length: 45 }, () => request(a, 'join', { name: 'Ada', code: 'ZZZZZZ' })),
    );
    expect(replies.some((r) => r.error?.includes('Too many'))).toBe(true);
  });
});
