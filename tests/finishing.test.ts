import { expect, it } from 'vitest';
import { GameRoom, defaultSettings, disconnectGraceMs } from '../server/engine';
import { OfflineValidator, sameWordFamily } from '../lib/words';

it('blocks verified adjective/noun/adverb derivatives in both directions', () => {
  const validator = new OfflineValidator();
  for (const [a, b] of [
    ['tranquil', 'tranquility'],
    ['tranquility', 'tranquillity'],
    ['happy', 'happiness'],
    ['brave', 'bravery'],
  ]) {
    expect(sameWordFamily(a, b), `${a}/${b}`).toBe(true);
  }
  expect(validator.validate('peace', 'tranquil', ['tranquility'], false)).toMatchObject({
    valid: false,
    reason: 'word is already repeated',
  });
  expect(validator.validate('peace', 'tranquility', ['tranquil'], false).valid).toBe(false);
  expect(sameWordFamily('coral', 'corral')).toBe(false);
  expect(sameWordFamily('universe', 'university')).toBe(false);
});
function roomWithThree() {
  let now = 1000;
  const room = new GameRoom('ABC234', undefined, () => now);
  const people = ['Ada', 'Ben', 'Cy'].map((name, index) => room.join(name, String(index)));
  room.configure(people[0].playerId, { ...defaultSettings, turnsPerPrompt: 1, rounds: 3 });
  people.forEach((p) => room.ready(p.playerId, true));
  room.start(people[0].playerId, ['ocean', 'fire', 'forest']);
  return {
    room,
    people,
    setTime: (value: number) => {
      now = value;
    },
  };
}
it('removes a departed active player, skips their future turns, and ends with one remaining', () => {
  const {
    room,
    people: [a, b, c],
  } = roomWithThree();
  room.leave(a.playerId, '0');
  expect(room.owns(a.playerId, '0')).toBe(false);
  expect(() => room.reconnect(a.playerId, a.token, 'new')).toThrow('restored');
  expect(room.state.activeId).toBe(b.playerId);
  room.submit(b.playerId, 'fish', room.state.turnId);
  room.submit(c.playerId, 'coral', room.state.turnId);
  expect(room.state.round).toBe(2);
  expect(room.state.activeId).toBe(b.playerId);
  room.leave(c.playerId, '2');
  expect(room.state.phase).toBe('results');
  expect(room.state.deadline).toBe(0);
  expect(room.player(c.playerId).score).toBe(35);
  room.rematch(b.playerId);
  expect(room.state.players.map((p) => p.name)).toEqual(['Ben']);
});
it('allows refresh during grace, kicks prolonged disconnects, and ignores stale disconnects', () => {
  const {
    room,
    people: [a, b],
    setTime,
  } = roomWithThree();
  room.disconnect(a.playerId, '0');
  setTime(1000 + disconnectGraceMs - 1);
  expect(room.pruneDisconnected()).toBe(false);
  room.reconnect(a.playerId, a.token, 'restored');
  room.disconnect(a.playerId, '0');
  expect(room.player(a.playerId).connected).toBe(true);
  room.disconnect(a.playerId, 'restored');
  setTime(1000 + 2 * disconnectGraceMs);
  expect(room.pruneDisconnected()).toBe(true);
  expect(room.player(a.playerId).eliminated).toBe(true);
  expect(room.state.activeId).toBe(b.playerId);
});
