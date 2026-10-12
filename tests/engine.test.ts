import { describe, it, expect } from 'vitest';
import { GameRoom, defaultSettings, roomCode } from '../server/engine';
import {
  normalize,
  rarity,
  OfflineValidator,
  prompts,
  sameWordFamily,
  oneEditAway,
} from '../lib/words';
import associations from '../data/associations.json';
function setup(settings = { ...defaultSettings, rounds: 2, turnsPerPrompt: 1 }) {
  let now = 1000;
  const room = new GameRoom('ABC234', undefined, () => now);
  const a = room.join('Ada', 'a'),
    b = room.join('Ben', 'b');
  room.configure(a.playerId, settings);
  room.ready(a.playerId, true);
  room.ready(b.playerId, true);
  room.start(a.playerId, ['ocean', 'fire']);
  return { room, a, b, setTime: (value: number) => (now = value) };
}
describe('word normalization and existence', () => {
  it('supports optional autocorrection including physic to physics', () => {
    const validator = new OfflineValidator();
    expect(validator.validate('science', 'physic', [], true)).toMatchObject({
      valid: true,
      word: 'physics',
      originalWord: 'physic',
    });
    expect(validator.validate('science', 'physic', [], false)).toMatchObject({
      valid: false,
      reason: 'Not found in the word list',
    });
    expect(validator.validate('science', 'physic', ['physics'], true)).toMatchObject({
      valid: false,
      reason: 'word is already repeated',
    });
    expect(validator.validate('ocean', 'corla', [], false).valid).toBe(false);
    expect(validator.validate('ocean', 'corral', [], true).valid).toBe(false);
  });
  it('rejects ambiguous corrections and does not treat object prototype names as relations', () => {
    const validator = new OfflineValidator();
    expect(validator.validate('fire', 'flane', [])).toMatchObject({
      valid: false,
      reason: 'Not found in the word list',
    });
    expect(validator.validate('ocean', 'constructor', []).valid).toBe(false);
  });
  it('normalizes Unicode, case, apostrophes, and whitespace consistently', () => {
    expect(normalize('  ＣＯＲＡＬ  ')).toBe('coral');
    expect(normalize('  sea\t  water  ')).toBe('sea water');
    expect(normalize('FOX’S')).toBe("fox's");
  });
  it('rejects repeated normalized words', () => {
    expect(new OfflineValidator().validate('ocean', ' CORAL ', ['coral']).valid).toBe(false);
  });
  it('rejects empty answers, phrases, typos, unsupported names, and prompt itself', () => {
    const validator = new OfflineValidator();
    for (const word of ['', 'sea water', 'sdfjqqq', 'AjitK999', 'ocean'])
      expect(validator.validate('ocean', word, []).valid).toBe(false);
  });
  it('corrects unique slight misspellings while retaining the submitted spelling', () => {
    const validator = new OfflineValidator();
    for (const word of ['corrl', 'corla', 'corl'])
      expect(validator.validate('ocean', word, [])).toMatchObject({
        valid: true,
        word: 'coral',
        originalWord: word,
      });
    expect(validator.validate('ocean', 'corla', ['coral']).valid).toBe(false);
    expect(validator.validate('ocean', 'corrrral', []).valid).toBe(false);
    // Real English words are never silently changed into another word.
    expect(validator.validate('ocean', 'corral', []).valid).toBe(false);
  });
  it('uses verified plural and tense families including irregular forms', () => {
    for (const [a, b] of [
      ['fish', 'fishes'],
      ['swim', 'swam'],
      ['swim', 'swimming'],
      ['leaf', 'leaves'],
      ['burn', 'burned'],
    ])
      expect(sameWordFamily(a, b)).toBe(true);
    for (const [a, b] of [
      ['glass', 'glas'],
      ['news', 'new'],
      ['universe', 'univers'],
    ])
      expect(sameWordFamily(a, b)).toBe(false);
    const validator = new OfflineValidator();
    expect(validator.validate('ocean', 'fishes', [])).toMatchObject({
      valid: true,
      word: 'fish',
      originalWord: 'fishes',
    });
    expect(validator.validate('ocean', 'fishes', ['fish']).valid).toBe(false);
    expect(validator.validate('ocean', 'fish', ['fishes']).valid).toBe(false);
    expect(validator.validate('tree', 'leaves', ['leaf']).valid).toBe(false);
    expect(validator.validate('ocean', 'oceans', []).valid).toBe(false);
  });
  it('limits spelling correction to one edit or adjacent transposition', () => {
    for (const [a, b] of [
      ['corrl', 'coral'],
      ['corla', 'coral'],
      ['corl', 'coral'],
      ['corall', 'coral'],
    ])
      expect(oneEditAway(a, b)).toBe(true);
    expect(oneEditAway('coral', 'coral')).toBe(false);
    expect(oneEditAway('corrrl', 'coral')).toBe(false);
  });
  it('accepts curated direct and indirect associations', () => {
    for (const word of ['smoke', 'combustion', 'phoenix', 'extinguisher'])
      expect(new OfflineValidator().validate('fire', word, []).valid).toBe(true);
  });
  it('does not accept unrelated dictionary words', () => {
    for (const word of ['refrigerator', 'spreadsheet', 'democracy'])
      expect(new OfflineValidator().validate('fire', word, []).valid).toBe(false);
  });
  it('supports lexical associations beyond the curated set', () => {
    expect(new OfflineValidator().validate('ocean', 'sea', []).valid).toBe(true);
    expect(new OfflineValidator().validate('tree', 'bonsai', []).relationship).toBe('lexical');
  });
  it('has at least 100 prompts with 50 separately playable curated answers each', () => {
    expect(prompts.length).toBeGreaterThanOrEqual(100);
    for (const prompt of prompts) {
      const accepted: string[] = [];
      const validator = new OfflineValidator();
      for (const word of (associations as Record<string, string>)[prompt].split(' ')) {
        expect(validator.validate(prompt, word, [], false).valid, `${prompt} → ${word}`).toBe(true);
        const result = validator.validate(prompt, word, accepted, false);
        if (result.valid) accepted.push(result.word);
      }
      expect(accepted.length, prompt).toBeGreaterThanOrEqual(50);
    }
  });
});
describe('measured frequency scoring', () => {
  it('calibrates using real Zipf values', () => {
    expect(rarity('water')).toMatchObject({ tier: 'Common', points: 10, zipf: 5.52 });
    expect(rarity('coral')).toMatchObject({ tier: 'Uncommon', points: 35 });
    expect(rarity('bathymetry')).toMatchObject({ tier: 'Esoteric', points: 120 });
    expect(rarity('thaumaturgy')).toMatchObject({ tier: 'Arcane', points: 175 });
  });
  it('uses a safe unranked fallback', () =>
    expect(rarity('notawordqqqq')).toMatchObject({ tier: 'Unranked', points: 10, zipf: null }));
  it('honors custom points', () =>
    expect(rarity('water', [9, 19, 29, 39, 49, 59, 69]).points).toBe(9));
});
describe('authoritative game engine', () => {
  it('keeps partial drafts separate from scores and clears them after a turn', () => {
    const { room, a, b } = setup();
    const turnId = room.state.turnId;
    for (const word of ['c', 'co', 'cor', 'co', '']) {
      room.typeWord(a.playerId, word, turnId);
      expect(room.state.typing).toEqual({ playerId: a.playerId, turnId, word });
      expect(room.player(a.playerId).score).toBe(0);
      expect(room.state.history).toHaveLength(0);
    }
    expect(() => room.typeWord(b.playerId, 'fish', turnId)).toThrow('turn');
    room.typeWord(a.playerId, 'coral', turnId);
    room.submit(a.playerId, 'coral', turnId);
    expect(room.state.typing).toBeNull();
    expect(() => room.typeWord(a.playerId, 'late', turnId)).toThrow('turn');
  });
  it('expires late drafts and clears disconnected players’ drafts', () => {
    const { room, a, b, setTime } = setup();
    const turnId = room.state.turnId;
    room.typeWord(a.playerId, 'water', turnId);
    room.disconnect(a.playerId, 'a');
    expect(room.state.typing).toBeNull();
    setTime(room.state.deadline);
    expect(() => room.typeWord(a.playerId, 'watery', turnId)).toThrow('turn');
    expect(room.state.activeId).toBe(b.playerId);
    expect(room.player(a.playerId).score).toBe(0);
  });
  it('creates unique short readable codes', () => {
    const codes = new Set(Array.from({ length: 500 }, () => roomCode()));
    expect(codes.size).toBe(500);
    for (const code of codes) expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
  });
  it('requires two ready connected players and host authorization', () => {
    const room = new GameRoom('ABC234');
    const a = room.join('Ada', 'a');
    expect(() => room.start(a.playerId)).toThrow();
    const b = room.join('Ben', 'b');
    expect(() => room.start(b.playerId)).toThrow('host');
    room.ready(a.playerId, true);
    expect(() => room.start(a.playerId)).toThrow('ready');
    room.ready(b.playerId, true);
    room.disconnect(b.playerId, 'b');
    expect(() => room.start(a.playerId)).toThrow('ready');
  });
  it('enforces duplicate names, capacity, and lobby-only joining', () => {
    const room = new GameRoom('ABC234');
    room.join('Ada', 'a');
    expect(() => room.join('ADA', 'b')).toThrow('taken');
    for (let i = 1; i < 8; i++) room.join(`Player ${i}`, `${i}`);
    expect(() => room.join('Ninth', 'x')).toThrow('full');
    const { room: playing } = setup();
    expect(() => playing.join('New', 'x')).toThrow('started');
  });
  it('scores only accepted answers and advances turns', () => {
    const { room, a, b } = setup();
    expect(() => room.submit(b.playerId, 'water', room.state.turnId)).toThrow('turn');
    expect(() => room.submit(a.playerId, 'democracy', room.state.turnId)).toThrow(
      'Not found in the word list',
    );
    expect(room.player(a.playerId).score).toBe(0);
    room.submit(a.playerId, ' CORAL ', room.state.turnId);
    expect(room.player(a.playerId).score).toBe(35);
    expect(room.state.activeId).toBe(b.playerId);
    expect(room.state.used).toEqual(['coral']);
  });
  it('rejects repeats without consuming time or turn', () => {
    const { room, a, b } = setup();
    room.submit(a.playerId, 'water', room.state.turnId);
    const id = room.state.turnId,
      deadline = room.state.deadline;
    expect(() => room.submit(b.playerId, 'WATER', id)).toThrow('already');
    expect(room.state.turnId).toBe(id);
    expect(room.state.deadline).toBe(deadline);
    expect(room.player(b.playerId).score).toBe(0);
  });
  it('rotates prompts after two turns each and clears the used list', () => {
    const { room, a, b } = setup({ ...defaultSettings, rounds: 2, turnsPerPrompt: 2 });
    for (const [id, word] of [
      [a.playerId, 'water'],
      [b.playerId, 'fish'],
      [a.playerId, 'coral'],
      [b.playerId, 'abyssal'],
    ])
      room.submit(id, word, room.state.turnId);
    expect(room.state.prompt).toBe('fire');
    expect(room.state.round).toBe(2);
    expect(room.state.used).toEqual([]);
    expect(room.state.activeId).toBe(b.playerId);
  });
  it('rotates the round starter through every player, including after timeouts', () => {
    let now = 0;
    const room = new GameRoom('ABC234', undefined, () => now);
    const players = ['Ada', 'Ben', 'Cleo'].map((name, i) => room.join(name, String(i)));
    room.configure(players[0].playerId, { ...defaultSettings, rounds: 4, turnsPerPrompt: 1 });
    players.forEach((p) => room.ready(p.playerId, true));
    room.start(players[0].playerId, ['ocean', 'fire', 'tree', 'music']);
    for (let round = 1; round <= 4; round++) {
      for (let turn = 0; turn < 3; turn++) {
        expect(room.state.activeId).toBe(players[(round - 1 + turn) % 3].playerId);
        now = room.state.deadline;
        room.tick();
      }
    }
    expect(room.state.phase).toBe('results');
  });
  it('scores corrected and inflected submissions using the accepted base word', () => {
    const { room, a, b } = setup({ ...defaultSettings, rounds: 1, turnsPerPrompt: 2 });
    room.submit(a.playerId, 'fishes', room.state.turnId);
    expect(room.state.history[0]).toMatchObject({
      word: 'fish',
      originalWord: 'fishes',
      points: 20,
    });
    expect(() => room.submit(b.playerId, 'fish', room.state.turnId)).toThrow('already');
    room.submit(b.playerId, 'corla', room.state.turnId);
    expect(room.state.history[1]).toMatchObject({
      word: 'coral',
      originalWord: 'corla',
      points: 35,
    });
    expect(() => room.submit(a.playerId, 'corals', room.state.turnId)).toThrow('already');
  });
  it('expires at the exact deadline and rejects late submissions', () => {
    const { room, a, b, setTime } = setup();
    setTime(room.state.deadline);
    expect(() => room.submit(a.playerId, 'water', room.state.turnId)).toThrow('turn');
    expect(room.state.activeId).toBe(b.playerId);
    expect(room.player(a.playerId).score).toBe(0);
  });
  it('cannot replay an old turn token even after cycling back', () => {
    const { room, a, b } = setup({ ...defaultSettings, rounds: 2, turnsPerPrompt: 2 });
    const old = room.state.turnId;
    room.submit(a.playerId, 'water', old);
    room.submit(b.playerId, 'fish', room.state.turnId);
    expect(() => room.submit(a.playerId, 'coral', old)).toThrow('ended');
  });
  it('a double submission scores at most once', () => {
    const { room, a } = setup();
    const token = room.state.turnId;
    room.submit(a.playerId, 'water', token);
    expect(() => room.submit(a.playerId, 'coral', token)).toThrow();
    expect(room.player(a.playerId).score).toBe(10);
    expect(room.state.history).toHaveLength(1);
  });
  it('finishes after configured turns and allows a host rematch', () => {
    const { room, a, b } = setup({ ...defaultSettings, rounds: 1, turnsPerPrompt: 1 });
    room.submit(a.playerId, 'water', room.state.turnId);
    room.submit(b.playerId, 'coral', room.state.turnId);
    expect(room.state.phase).toBe('results');
    expect(room.state.deadline).toBe(0);
    expect(room.player(b.playerId).score).toBe(35);
    room.rematch(a.playerId);
    expect(room.state.phase).toBe('lobby');
    expect(room.state.players.every((p) => !p.ready && p.score === 0)).toBe(true);
  });
  it('reassigns host, authenticates reconnection, and ignores stale disconnects', () => {
    const { room, a, b } = setup();
    room.disconnect(a.playerId, 'a');
    expect(room.state.hostId).toBe(b.playerId);
    expect(() => room.reconnect(a.playerId, 'wrong', 'new')).toThrow('restored');
    room.reconnect(a.playerId, a.token, 'new');
    room.disconnect(a.playerId, 'a');
    expect(room.player(a.playerId).connected).toBe(true);
    expect(room.owns(a.playerId, 'a')).toBe(false);
  });
  it('reclaims disconnected lobby seats after the grace period', () => {
    let now = 0;
    const room = new GameRoom('ABC234', undefined, () => now);
    const a = room.join('Ada', 'a');
    room.disconnect(a.playerId, 'a');
    now = 120001;
    expect(room.pruneDisconnected()).toBe(true);
    expect(room.state.players).toHaveLength(0);
  });
  it('rejects invalid settings and clears readiness on configuration', () => {
    const room = new GameRoom('ABC234'),
      a = room.join('Ada', 'a');
    room.ready(a.playerId, true);
    expect(() => room.configure(a.playerId, { ...defaultSettings, points: [1] })).toThrow();
    room.configure(a.playerId, { ...defaultSettings, turnSeconds: 30 });
    expect(room.player(a.playerId).ready).toBe(false);
  });
});
