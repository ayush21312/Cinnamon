export type Settings = {
  turnSeconds: number;
  turnsPerPrompt: number;
  rounds: number;
  points: number[];
};
export type Player = {
  eliminated?: boolean;
  id: string;
  name: string;
  connected: boolean;
  ready: boolean;
  score: number;
};
export type Submission = {
  originalWord?: string;
  id: string;
  playerId: string;
  word: string;
  prompt: string;
  points: number;
  tier: string;
  tierIndex: number;
  zipf: number | null;
  reason: string;
  at: number;
};
export type TypingUpdate = { playerId: string; turnId: string; word: string };
export type RoomState = {
  mode: 'classic' | 'practice';
  code: string;
  hostId: string;
  phase: 'lobby' | 'playing' | 'results';
  players: Player[];
  settings: Settings;
  prompt: string;
  round: number;
  turn: number;
  turnId: string;
  typing: TypingUpdate | null;
  activeId: string;
  deadline: number;
  used: string[];
  history: Submission[];
  lastEvent: { id: string; message: string } | null;
  serverNow: number;
  matchId: string;
  persistence: 'disabled' | 'pending' | 'saved' | 'failed';
};
export type Reply = {
  messages?: ChatMessage[];
  ok: boolean;
  error?: string;
  playerId?: string;
  token?: string;
  code?: string;
};
export type ChatMessage = { id: string; playerId: string; name: string; text: string; at: number };
