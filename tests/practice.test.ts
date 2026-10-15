import { afterEach, describe, expect, it, vi } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { GameRoom } from '../server/engine';
import { createGameServer } from '../server/socket';
import { rarity, OfflineValidator } from '../lib/words';
import bank from '../data/associations.json';
import type { Reply, RoomState } from '../lib/types';

function practice() {
  let now = 1000;
  const room = new GameRoom('ABC234', undefined, () => now, 'practice');
  const identity = room.join('You', 'a');
  room.ready(identity.playerId, true);
  room.start(identity.playerId, ['ocean', 'rain']);
  return {
    room,
    identity,
    advance: (ms: number) => {
      now += ms;
    },
  };
}
describe('timed practice engine', () => {
  it('changes prompts after accepted guesses, refreshes the timer, and leaves invalid guesses on the same prompt', () => {
    const { room, identity, advance } = practice();
    const oldTurn = room.state.turnId;
    advance(5000);
    room.submit(identity.playerId, 'water', oldTurn, false);
    expect(room.state).toMatchObject({
      mode: 'practice',
      phase: 'playing',
      round: 2,
      prompt: 'rain',
      deadline: 21000,
      used: [],
    });
    expect(room.state.history).toHaveLength(1);
    expect(room.state.history[0]).toMatchObject({
      word: 'water',
      prompt: 'ocean',
      tier: rarity('water').tier,
      points: rarity('water').points,
    });
    expect(room.state.turnId).not.toBe(oldTurn);
    expect(() => room.submit(identity.playerId, 'fish', oldTurn, false)).toThrow(
      'That turn has ended',
    );
    const deadline = room.state.deadline,
      turn = room.state.turnId;
    expect(() => room.submit(identity.playerId, 'zzqqqq', turn, false)).toThrow(
      'Not found in the word list',
    );
    expect(room.state.deadline).toBe(deadline);
    expect(room.state.prompt).toBe('rain');
    expect(room.player(identity.playerId).score).toBe(rarity('water').points);
    advance(5000);
    room.submit(identity.playerId, 'water', turn, false);
    expect(room.state.phase).toBe('results');
    expect(room.state.history).toHaveLength(2);
    expect(room.player(identity.playerId).score).toBe(rarity('water').points * 2);
    expect(() => room.join('Other', 'b')).toThrow();
  });
  it('clears repeats only when changing prompts and rejects stale prompt requests', () => {
    const { room, identity } = practice();
    const previous = room.state.turnId;
    room.nextPracticePrompt(identity.playerId, previous);
    expect(room.state).toMatchObject({ round: 2, prompt: 'rain', used: [], deadline: 16000 });
    expect(() => room.nextPracticePrompt(identity.playerId, previous)).toThrow(
      'That prompt has ended',
    );
    expect(() => room.submit(identity.playerId, 'fish', previous, false)).toThrow(
      'That turn has ended',
    );
    room.submit(identity.playerId, 'water', room.state.turnId, false);
    expect(room.state.history).toHaveLength(1);
    expect(room.state.phase).toBe('results');
  });
  it('finishes on demand and restarts directly into a clean practice session', () => {
    const { room, identity } = practice();
    room.submit(identity.playerId, 'fish', room.state.turnId, false);
    const match = room.state.matchId;
    room.finishPractice(identity.playerId);
    expect(room.state.phase).toBe('results');
    expect(() => room.submit(identity.playerId, 'coral', room.state.turnId)).toThrow();
    room.rematch(identity.playerId);
    expect(room.state).toMatchObject({
      phase: 'playing',
      mode: 'practice',
      round: 1,
      history: [],
      used: [],
    });
    expect(room.state.matchId).not.toBe(match);
    expect(room.player(identity.playerId).score).toBe(0);
  });
  it('keeps multiplayer minimum-player rules and practice actions separate', () => {
    const room = new GameRoom('ABC234');
    const { playerId } = room.join('Ada', 'a');
    room.ready(playerId, true);
    expect(() => room.start(playerId)).toThrow('At least two');
    expect(() => room.finishPractice(playerId)).toThrow('Practice is not active');
  });
  it('restores a practice score through a short disconnection without extending the timer', () => {
    const { room, identity, advance } = practice();
    room.submit(identity.playerId, 'coral', room.state.turnId, false);
    const score = room.player(identity.playerId).score;
    room.disconnect(identity.playerId, 'a');
    advance(9000);
    expect(room.pruneDisconnected()).toBe(false);
    room.reconnect(identity.playerId, identity.token, 'new');
    expect(room.state.phase).toBe('playing');
    expect(room.player(identity.playerId).score).toBe(score);
    expect(room.tick()).toBe(false);
    expect(room.state.deadline).toBe(16000);
  });
  it('rejects answers exactly at expiration, rotates the prompt once, and completes the final prompt', () => {
    const { room, identity, advance } = practice();
    const expiredTurn = room.state.turnId;
    advance(15000);
    expect(() => room.submit(identity.playerId, 'coral', expiredTurn, false)).toThrow(
      'That turn has ended',
    );
    expect(room.state).toMatchObject({ prompt: 'rain', round: 2, deadline: 31000 });
    expect(room.player(identity.playerId).score).toBe(0);
    expect(room.state.history).toHaveLength(0);
    expect(room.tick()).toBe(false);
    advance(15000);
    expect(room.tick()).toBe(true);
    expect(room.state.phase).toBe('results');
    expect(room.tick()).toBe(false);
  });
});

const servers: ReturnType<typeof createGameServer>[] = [],
  clients: Socket[] = [];
afterEach(async () => {
  clients.splice(0).forEach((s) => s.disconnect());
  await Promise.all(servers.splice(0).map((s) => s.close()));
});
function request(s: Socket, event: string, payload: unknown = {}): Promise<Reply> {
  return new Promise((resolve, reject) =>
    s
      .timeout(2500)
      .emit(event, payload, (err: Error | null, reply: Reply) =>
        err ? reject(err) : resolve(reply),
      ),
  );
}
it('starts practice immediately over Socket.IO, rejects outsiders and duplicate races, and excludes practice from persistence', async () => {
  const save = vi.fn(async (_state: RoomState) => {});
  const server = createGameServer({ saveResult: save });
  servers.push(server);
  await new Promise<void>((resolve) => server.http.listen(0, '127.0.0.1', resolve));
  const address = server.http.address();
  if (!address || typeof address === 'string') throw Error('No port');
  const url = `http://127.0.0.1:${address.port}`;
  async function connect() {
    const socket = io(url, { autoConnect: false, reconnection: false, transports: ['websocket'] });
    clients.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
      socket.connect();
    });
    return socket;
  }
  const a = await connect(),
    outsider = await connect();
  const created = await request(a, 'practice', { name: 'You' });
  expect(created.ok).toBe(true);
  const room = server.rooms.get(created.code!)!;
  expect(room.state).toMatchObject({ mode: 'practice', phase: 'playing' });
  expect(room.state.deadline).toBeGreaterThan(0);
  expect(room.state.players).toHaveLength(1);
  expect((await request(outsider, 'join', { name: 'Other', code: created.code })).ok).toBe(false);
  expect((await request(outsider, 'practice:finish')).ok).toBe(false);
  const validator = new OfflineValidator();
  const answer = (bank as Record<string, string>)[room.state.prompt]
    .split(' ')
    .find((word) => validator.validate(room.state.prompt, word, [], false).valid)!;
  const payload = { word: answer, turnId: room.state.turnId };
  const results = await Promise.all([request(a, 'submit', payload), request(a, 'submit', payload)]);
  expect(results.map((result) => result.ok)).toEqual([true, false]);
  expect(room.state.history).toHaveLength(1);
  expect(room.player(created.playerId!).score).toBe(room.state.history[0].points);
  expect((await request(a, 'practice:next', { turnId: room.state.turnId, score: 99999 })).ok).toBe(
    false,
  );
  expect((await request(a, 'practice:finish')).ok).toBe(true);
  expect(room.state.phase).toBe('results');
  expect(save).not.toHaveBeenCalled();
  expect((await request(a, 'rematch')).ok).toBe(true);
  expect(room.state.phase).toBe('playing');
});
