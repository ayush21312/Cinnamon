import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { RoomState, Settings } from '../lib/types';
import {
  defaultPoints,
  OfflineValidator,
  prompts,
  rarity,
  type AssociationValidator,
} from '../lib/words';
export const settingsSchema = z
  .object({
    turnSeconds: z.number().int().min(5).max(60),
    turnsPerPrompt: z.number().int().min(1).max(4),
    rounds: z.number().int().min(1).max(10),
    points: z.array(z.number().int().min(1).max(1000)).length(7),
  })
  .strict();
export const defaultSettings: Settings = {
  turnSeconds: 15,
  turnsPerPrompt: 2,
  rounds: 3,
  points: defaultPoints,
};
export const disconnectGraceMs = 10_000;
export const nameSchema = z
  .string()
  .trim()
  .min(1)
  .max(20)
  .regex(/^[\p{L}\p{N} _.-]+$/u, 'Names may contain letters, numbers, spaces, dots, and hyphens.');
type Identity = { token: string; socketId: string | null; disconnectedAt: number | null };
export class GameRoom {
  state: RoomState;
  identities = new Map<string, Identity>();
  private deck: string[] = [];
  lastActivity: number;
  constructor(
    code: string,
    private validator: AssociationValidator = new OfflineValidator(),
    private now: () => number = Date.now,
    mode: RoomState['mode'] = 'classic',
  ) {
    this.lastActivity = this.now();
    this.state = {
      mode,
      code,
      hostId: '',
      phase: 'lobby',
      players: [],
      settings: { ...defaultSettings, points: [...defaultPoints] },
      prompt: '',
      round: 0,
      turn: 0,
      turnId: '',
      typing: null,
      activeId: '',
      deadline: 0,
      used: [],
      history: [],
      lastEvent: null,
      serverNow: this.now(),
      matchId: '',
      persistence: 'disabled',
    };
  }
  join(nameInput: string, socketId: string) {
    const name = nameSchema.parse(nameInput).normalize('NFKC');
    if (this.state.phase !== 'lobby') throw Error('This game has already started.');
    if (this.state.mode === 'practice' && this.state.players.length)
      throw Error('Practice is solo only.');
    if (this.state.players.length >= 8) throw Error('This room is full (8 players).');
    if (this.state.players.some((p) => p.name.toLowerCase() === name.toLowerCase()))
      throw Error('That name is already taken in this room.');
    const id = randomUUID(),
      token = randomBytes(32).toString('hex');
    this.state.players.push({ id, name, score: 0, ready: false, connected: true });
    this.identities.set(id, { token, socketId, disconnectedAt: null });
    if (!this.state.hostId) this.state.hostId = id;
    this.touch();
    return { playerId: id, token };
  }
  reconnect(id: string, token: string, socketId: string) {
    const identity = this.identities.get(id);
    if (!identity || identity.token !== token)
      throw Error('Your room session could not be restored.');
    const previousSocket = identity.socketId;
    identity.socketId = socketId;
    identity.disconnectedAt = null;
    this.player(id).connected = true;
    if (!this.state.hostId) this.state.hostId = id;
    this.touch();
    return previousSocket;
  }
  owns(id: string, socketId: string) {
    return this.identities.get(id)?.socketId === socketId;
  }
  player(id: string) {
    const p = this.state.players.find((p) => p.id === id);
    if (!p) throw Error('Player not found.');
    return p;
  }
  ready(id: string, ready: boolean) {
    if (this.state.phase !== 'lobby') throw Error('Readiness can only change in the lobby.');
    this.player(id).ready = ready;
    this.touch();
  }
  configure(id: string, input: unknown) {
    this.host(id);
    if (this.state.phase !== 'lobby') throw Error('Settings are locked during a match.');
    this.state.settings = settingsSchema.parse(input);
    this.state.players.forEach((p) => (p.ready = false));
    this.touch();
  }
  host(id: string) {
    if (this.state.hostId !== id) throw Error('Only the host can do that.');
  }
  start(id: string, deck?: string[]) {
    this.host(id);
    if (this.state.phase !== 'lobby') throw Error('A match is already underway.');
    const players = this.state.players;
    if (
      players.length < (this.state.mode === 'practice' ? 1 : 2) ||
      players.some((p) => !p.connected || !p.ready)
    )
      throw Error('At least two connected, ready players are needed.');
    this.deck =
      deck ??
      (this.state.mode === 'practice'
        ? shuffle(prompts)
        : shuffle(prompts).slice(0, this.state.settings.rounds));
    if (this.state.mode === 'practice') this.state.settings.rounds = this.deck.length;
    this.state.phase = 'playing';
    this.state.matchId = randomUUID();
    this.state.history = [];
    this.state.used = [];
    this.state.lastEvent = null;
    this.state.persistence = 'disabled';
    players.forEach((p) => (p.score = 0));
    this.state.round = 1;
    this.state.turn = 0;
    this.state.prompt = this.deck[0];
    this.beginTurn(0);
    this.touch();
  }
  typeWord(id: string, word: string, turnId: string) {
    this.tick();
    if (this.state.phase !== 'playing') throw Error('The match is not accepting words.');
    if (this.state.activeId !== id) throw Error('Wait for your turn.');
    if (this.state.turnId !== turnId) throw Error('That turn has ended.');
    this.state.typing = { playerId: id, turnId, word };
  }
  submit(id: string, answer: string, turnId: string, autocorrect = true) {
    this.tick();
    if (this.state.phase !== 'playing') throw Error('The match is not accepting answers.');
    if (this.state.activeId !== id) throw Error('Wait for your turn.');
    if (this.state.turnId !== turnId) throw Error('That turn has ended.');
    const result = this.validator.validate(this.state.prompt, answer, this.state.used, autocorrect);
    if (!result.valid) throw Error(result.reason);
    const rank = rarity(result.word, this.state.settings.points),
      at = this.now();
    this.player(id).score += rank.points;
    this.state.used.push(result.word);
    this.state.history.push({
      id: randomUUID(),
      playerId: id,
      word: result.word,
      ...(result.originalWord ? { originalWord: result.originalWord } : {}),
      prompt: this.state.prompt,
      ...rank,
      reason: result.reason,
      at,
    });
    this.state.lastEvent = {
      id: randomUUID(),
      message: `${this.player(id).name} played ${result.originalWord ? `${result.originalWord} → ` : ''}${result.word} · +${rank.points}`,
    };
    if (this.state.mode === 'practice') {
      this.nextPracticePrompt(id, turnId);
    } else this.advance();
    this.touch();
  }
  nextPracticePrompt(id: string, turnId: string) {
    this.requirePractice(id);
    if (turnId !== this.state.turnId) throw Error('That prompt has ended.');
    if (this.state.round >= this.deck.length) {
      this.finishPractice(id);
      return;
    }
    this.state.round++;
    this.state.prompt = this.deck[this.state.round - 1];
    this.state.used = [];
    this.state.typing = null;
    this.state.lastEvent = null;
    this.beginTurn(0);
    this.touch();
  }
  finishPractice(id: string) {
    this.requirePractice(id);
    this.state.phase = 'results';
    this.state.activeId = '';
    this.state.deadline = 0;
    this.state.typing = null;
    this.state.lastEvent = { id: randomUUID(), message: 'Practice complete.' };
    this.touch();
  }
  private requirePractice(id: string) {
    this.host(id);
    if (this.state.mode !== 'practice' || this.state.phase !== 'playing')
      throw Error('Practice is not active.');
  }
  private beginTurn(index: number) {
    this.state.activeId = this.state.players[index].id;
    this.state.turnId = randomUUID();
    this.state.deadline = this.now() + this.state.settings.turnSeconds * 1000;
  }
  private advance() {
    const s = this.state,
      index = s.players.findIndex((p) => p.id === s.activeId);
    s.typing = null;
    s.turn++;
    if (s.turn >= s.players.length * s.settings.turnsPerPrompt) {
      if (s.round >= s.settings.rounds) {
        s.phase = 'results';
        s.deadline = 0;
        s.activeId = '';
        return;
      }
      s.round++;
      s.turn = 0;
      s.used = [];
      s.prompt = this.deck[s.round - 1];
      this.beginTurn((s.round - 1) % s.players.length);
      if (this.player(s.activeId).eliminated) this.advance();
      return;
    }
    this.beginTurn((index + 1) % s.players.length);
    if (this.player(s.activeId).eliminated) this.advance();
  }
  tick() {
    if (this.state.phase === 'playing' && this.now() >= this.state.deadline) {
      if (this.state.mode === 'practice') {
        this.nextPracticePrompt(this.state.hostId, this.state.turnId);
        this.touch();
        return true;
      }
      this.state.lastEvent = {
        id: randomUUID(),
        message: `${this.player(this.state.activeId).name} ran out of time.`,
      };
      this.advance();
      this.touch();
      return true;
    }
    return false;
  }
  disconnect(id: string, socketId: string) {
    if (!this.owns(id, socketId)) return;
    const identity = this.identities.get(id)!;
    identity.socketId = null;
    identity.disconnectedAt = this.now();
    this.player(id).connected = false;
    if (this.state.typing?.playerId === id) this.state.typing = null;
    this.player(id).ready = false;
    if (this.state.hostId === id)
      this.state.hostId = this.state.players.find((p) => p.connected)?.id ?? '';
    this.touch();
  }
  leave(id: string, socketId: string) {
    if (!this.owns(id, socketId)) return;
    if (this.state.phase === 'playing') {
      this.disconnect(id, socketId);
      this.eliminate(id);
      return;
    }
    this.identities.delete(id);
    this.state.players = this.state.players.filter((p) => p.id !== id);
    if (this.state.hostId === id)
      this.state.hostId = this.state.players.find((p) => p.connected)?.id ?? '';
    this.touch();
  }
  pruneDisconnected() {
    let changed = false;
    for (const [id, identity] of this.identities)
      if (
        identity.disconnectedAt !== null &&
        this.now() - identity.disconnectedAt >= disconnectGraceMs
      ) {
        if (this.state.phase !== 'lobby') this.eliminate(id);
        else {
          this.identities.delete(id);
          this.state.players = this.state.players.filter((p) => p.id !== id);
        }
        changed = true;
      }
    return changed;
  }
  private eliminate(id: string) {
    const player = this.player(id);
    player.eliminated = true;
    player.connected = false;
    player.ready = false;
    this.identities.delete(id);
    if (this.state.typing?.playerId === id) this.state.typing = null;
    const remaining = this.state.players.filter((p) => !p.eliminated);
    if (remaining.length <= 1) {
      this.state.phase = 'results';
      this.state.deadline = 0;
      this.state.activeId = '';
      this.state.typing = null;
      this.state.lastEvent = { id: randomUUID(), message: 'Game ended: only one player remains.' };
    } else if (this.state.activeId === id) this.advance();
    this.touch();
  }
  rematch(id: string) {
    this.host(id);
    if (this.state.phase !== 'results') throw Error('Finish this game first.');
    this.state.phase = 'lobby';
    this.state.players = this.state.players.filter(
      (p) => !p.eliminated && this.identities.has(p.id),
    );
    this.state.players.forEach((p) => {
      p.score = 0;
      p.ready = false;
    });
    this.state.history = [];
    this.state.used = [];
    this.state.prompt = '';
    this.state.lastEvent = null;
    this.state.typing = null;
    this.touch();
    if (this.state.mode === 'practice') {
      this.player(id).ready = true;
      this.start(id);
    }
  }
  snapshot() {
    return { ...this.state, serverNow: this.now() };
  }
  private touch() {
    this.lastActivity = this.now();
  }
}
function shuffle<T>(values: T[]) {
  const array = [...values];
  for (let i = array.length - 1; i > 0; i--) {
    const j = randomBytes(4).readUInt32BE() % (i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
export function roomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(randomBytes(6), (n) => alphabet[n % alphabet.length]).join('');
}
