import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { Server, type Socket } from 'socket.io';
import { z } from 'zod';
import { GameRoom, nameSchema, roomCode } from './engine';
import type { ChatMessage, Reply, RoomState } from '../lib/types';
type Options = {
  origin?: string | string[];
  saveResult?: ((state: RoomState) => Promise<void>) | null;
  tickMs?: number;
  now?: () => number;
};
type Session = { room: GameRoom; playerId: string };
const codeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-HJ-NP-Z2-9]{6}$/);
const joinSchema = z.object({ name: nameSchema, code: codeSchema }).strict();
const resumeSchema = z
  .object({
    code: codeSchema,
    playerId: z.string().uuid(),
    token: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
const answerSchema = z
  .object({
    word: z.string().max(64),
    turnId: z.string().uuid(),
    autocorrect: z.boolean().default(true),
  })
  .strict();
const typingSchema = z
  .object({
    word: z
      .string()
      .max(32)
      .regex(/^[\p{L}\p{M}\p{N} '\-]*$/u),
    turnId: z.string().uuid(),
  })
  .strict();
export function createGameServer(options: Options = {}) {
  const rooms = new Map<string, GameRoom>();
  // Chat is separate from scoring snapshots and is never saved to Supabase.
  const chats = new Map<
    string,
    { messages: ChatMessage[]; buckets: Map<string, { at: number; count: number }> }
  >();
  const now = options.now ?? Date.now;
  const http = createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ service: 'cinammon', ok: true, rooms: rooms.size }));
  });
  const allowed = options.origin ?? 'http://localhost:3000';
  const io = new Server(http, {
    cors: { origin: allowed },
    maxHttpBufferSize: 4096,
    allowRequest: (req, done) => {
      const origin = req.headers.origin;
      done(
        null,
        !origin || (typeof allowed === 'string' ? origin === allowed : allowed.includes(origin)),
      );
    },
  });
  const pendingSaves = new Set<string>();
  const persisted = new Set<string>();
  const buckets = new Map<string, { at: number; count: number }>();
  function broadcast(room: GameRoom) {
    io.to(room.state.code).emit('state', room.snapshot());
    if (room.state.phase === 'results') void persist(room);
  }
  async function persist(room: GameRoom) {
    if (room.state.mode === 'practice') return;
    const id = room.state.matchId;
    if (!options.saveResult || pendingSaves.has(id) || persisted.has(id)) return;
    pendingSaves.add(id);
    room.state.persistence = 'pending';
    io.to(room.state.code).emit('state', room.snapshot());
    const result = structuredClone(room.snapshot());
    try {
      await options.saveResult(result);
      persisted.add(id);
      if (room.state.matchId === id) room.state.persistence = 'saved';
    } catch {
      console.error('Match persistence failed; verify Supabase configuration.');
      if (room.state.matchId === id) room.state.persistence = 'failed';
      persisted.add(id);
    } finally {
      pendingSaves.delete(id);
      io.to(room.state.code).emit('state', room.snapshot());
    }
  }
  io.on('connection', (socket: Socket) => {
    let session: Session | null = null;
    let localBucket = { at: now(), count: 0 };
    let typingBucket = { at: now(), count: 0 };
    const limit = () => {
      const at = now();
      if (at - localBucket.at > 10_000) localBucket = { at, count: 0 };
      const ip = socket.handshake.address;
      let bucket = buckets.get(ip);
      if (!bucket || at - bucket.at > 60_000) {
        bucket = { at, count: 0 };
        buckets.set(ip, bucket);
      }
      if (++localBucket.count > 40 || ++bucket.count > 600)
        throw Error('Too many requests. Take a moment and try again.');
    };
    const requireSession = () => {
      if (!session || !session.room.owns(session.playerId, socket.id))
        throw Error('Join a room first.');
      return session;
    };
    const handle = (event: string, fn: (payload: unknown) => Partial<Reply> | void) =>
      socket.on(event, (payload: unknown, ack: unknown) => {
        const respond = typeof ack === 'function' ? (ack as (reply: Reply) => void) : () => {};
        try {
          limit();
          const result = fn(payload);
          respond({ ok: true, ...result });
        } catch (error) {
          respond({
            ok: false,
            error:
              error instanceof z.ZodError
                ? 'Please check your input.'
                : error instanceof Error
                  ? error.message
                  : 'Something went wrong.',
          });
          if (session) broadcast(session.room);
        }
      });
    function detach() {
      if (session) {
        session.room.leave(session.playerId, socket.id);
        socket.leave(session.room.state.code);
        broadcast(session.room);
        session = null;
      }
    }
    function attach(room: GameRoom, name: string, sync = true) {
      if (session) throw Error('Leave your current room before joining another.');
      const identity = room.join(name, socket.id);
      session = { room, playerId: identity.playerId };
      socket.join(room.state.code);
      if (sync) broadcast(room);
      return { ...identity, code: room.state.code };
    }
    handle('create', (payload) => {
      const { name } = z.object({ name: nameSchema }).strict().parse(payload);
      if (session) throw Error('Leave your current room first.');
      if (rooms.size >= 500) throw Error('The server is full. Try again later.');
      let code = roomCode();
      while (rooms.has(code)) code = roomCode();
      const room = new GameRoom(code, undefined, now);
      const result = attach(room, name);
      rooms.set(code, room);
      return result;
    });
    handle('join', (payload) => {
      const { code, name } = joinSchema.parse(payload);
      const room = rooms.get(code);
      if (!room) throw Error('Room not found. Check the code.');
      return attach(room, name);
    });
    handle('practice', (payload) => {
      const { name } = z.object({ name: nameSchema }).strict().parse(payload);
      if (session) throw Error('Leave your current room first.');
      if (rooms.size >= 500) throw Error('The server is full. Try again later.');
      let code = roomCode();
      while (rooms.has(code)) code = roomCode();
      const room = new GameRoom(code, undefined, now, 'practice');
      const result = attach(room, name, false);
      room.ready(result.playerId, true);
      room.start(result.playerId);
      rooms.set(code, room);
      broadcast(room);
      return result;
    });
    handle('practice:next', (payload) => {
      const { room, playerId } = requireSession();
      const { turnId } = z.object({ turnId: z.string().uuid() }).strict().parse(payload);
      room.nextPracticePrompt(playerId, turnId);
      broadcast(room);
    });
    handle('practice:finish', () => {
      const { room, playerId } = requireSession();
      room.finishPractice(playerId);
      broadcast(room);
    });
    handle('resume', (payload) => {
      const { code, playerId, token } = resumeSchema.parse(payload);
      const room = rooms.get(code);
      if (!room) throw Error('That room has expired or the server restarted.');
      if (session) throw Error('You already have a room session.');
      const previous = room.reconnect(playerId, token, socket.id);
      session = { room, playerId };
      socket.join(code);
      if (previous && previous !== socket.id) io.sockets.sockets.get(previous)?.disconnect(true);
      broadcast(room);
      return { playerId, code };
    });
    handle('ready', (payload) => {
      const { room, playerId } = requireSession();
      room.ready(playerId, z.boolean().parse(payload));
      broadcast(room);
    });
    handle('settings', (payload) => {
      const { room, playerId } = requireSession();
      room.configure(playerId, payload);
      broadcast(room);
    });
    handle('start', () => {
      const { room, playerId } = requireSession();
      room.start(playerId);
      broadcast(room);
    });
    handle('submit', (payload) => {
      const { room, playerId } = requireSession();
      const { word, turnId, autocorrect } = answerSchema.parse(payload);
      room.submit(playerId, word, turnId, autocorrect);
      broadcast(room);
    });
    handle('chat:history', () => {
      const { room } = requireSession();
      return { messages: chats.get(room.state.code)?.messages ?? [] };
    });
    handle('chat:send', (payload) => {
      const { room, playerId } = requireSession();
      const { text } = z
        .object({
          text: z
            .string()
            .max(400)
            .transform((value) =>
              value
                .normalize('NFKC')
                .replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim(),
            )
            .pipe(z.string().min(1).max(200)),
        })
        .strict()
        .parse(payload);
      const player = room.state.players.find(
        (p) => p.id === playerId && p.connected && !p.eliminated,
      );
      if (!player) throw Error('Join a room first.');
      let chat = chats.get(room.state.code);
      if (!chat) {
        chat = { messages: [], buckets: new Map() };
        chats.set(room.state.code, chat);
      }
      const at = now();
      let bucket = chat.buckets.get(playerId);
      if (!bucket || at - bucket.at >= 10_000) {
        bucket = { at, count: 0 };
        chat.buckets.set(playerId, bucket);
      }
      if (++bucket.count > 5) throw Error('Please wait a moment before sending another message.');
      const message: ChatMessage = { id: randomUUID(), playerId, name: player.name, text, at };
      chat.messages.push(message);
      if (chat.messages.length > 50) chat.messages.shift();
      io.to(room.state.code).emit('chat:message', message);
    });
    // Drafts are ephemeral: one small event per edit, never a scoring operation.
    // A separate limit lets players type normally without using the action budget.
    socket.on('typing', (payload: unknown, ack: unknown) => {
      const respond = typeof ack === 'function' ? (ack as (reply: Reply) => void) : () => {};
      const beforeTurn = session?.room.state.turnId;
      const beforePhase = session?.room.state.phase;
      try {
        const { room, playerId } = requireSession();
        const at = now();
        if (at - typingBucket.at >= 1000) typingBucket = { at, count: 0 };
        if (++typingBucket.count > 30) throw Error('Typing too quickly.');
        const { word, turnId } = typingSchema.parse(payload);
        room.typeWord(playerId, word, turnId);
        io.to(room.state.code).emit('typing', room.state.typing);
        respond({ ok: true });
      } catch (error) {
        respond({ ok: false, error: error instanceof Error ? error.message : 'Invalid draft.' });
        // Late edits can expire a turn. Send fresh authoritative state without
        // broadcasting a full snapshot for every ordinary rejected typing event.
        if (
          session &&
          (session.room.state.turnId !== beforeTurn || session.room.state.phase !== beforePhase)
        )
          broadcast(session.room);
      }
    });
    handle('rematch', () => {
      const { room, playerId } = requireSession();
      room.rematch(playerId);
      broadcast(room);
    });
    handle('leave', () => {
      detach();
    });
    socket.on('disconnect', () => {
      if (session) {
        session.room.disconnect(session.playerId, socket.id);
        broadcast(session.room);
      }
    });
  });
  const interval = setInterval(() => {
    for (const [code, room] of rooms) {
      const expired = room.tick();
      const pruned = room.pruneDisconnected();
      if (expired || pruned) broadcast(room);
      if (room.identities.size === 0) {
        rooms.delete(code);
        chats.delete(code);
        continue;
      }
      if (!room.state.players.some((p) => p.connected) && now() - room.lastActivity > 30 * 60_000) {
        rooms.delete(code);
        chats.delete(code);
      }
      for (const playerId of chats.get(code)?.buckets.keys() ?? [])
        if (!room.identities.has(playerId)) chats.get(code)?.buckets.delete(playerId);
    }
    for (const [ip, bucket] of buckets) if (now() - bucket.at > 60_000) buckets.delete(ip);
  }, options.tickMs ?? 100);
  interval.unref();
  return {
    http,
    io,
    rooms,
    close: () =>
      new Promise<void>((resolve) => {
        clearInterval(interval);
        io.close(() => resolve());
      }),
  };
}
