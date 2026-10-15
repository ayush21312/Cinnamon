'use client';
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { io, type Socket } from 'socket.io-client';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import {
  ArrowRight,
  Check,
  Copy,
  Crown,
  DoorOpen,
  Settings2,
  Users,
  UserRound,
  X,
  WifiOff,
  RotateCcw,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { Reply, RoomState, Settings, Submission, TypingUpdate } from '../lib/types';
import WordArt from './WordArt';
import RoomChat from './RoomChat';
import PracticeGame from './PracticeGame';
import { GameSounds, type SoundEffect } from '../lib/sounds';
import { stateSound } from '../lib/game-feedback';
import { animate, useReducedMotion } from 'motion/react';
import { parseRoomCode } from '../lib/room-code';

const TIER_NAMES = ['Common', 'Familiar', 'Uncommon', 'Rare', 'Obscure', 'Esoteric', 'Arcane'];
const POINTS = [10, 20, 35, 55, 80, 120, 175];
const defaults: Settings = { turnSeconds: 15, turnsPerPrompt: 2, rounds: 3, points: POINTS };
type Identity = { code: string; playerId: string; token: string };
type Dialog = 'create' | 'join' | 'help' | 'settings' | null;
export default function Page() {
  const socket = useRef<Socket | null>(null),
    identity = useRef<Identity | null>(null),
    input = useRef<HTMLInputElement>(null);
  const [connected, setConnected] = useState(false),
    [room, setRoom] = useState<RoomState | null>(null),
    [me, setMe] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null),
    [name, setName] = useState(''),
    [code, setCode] = useState(''),
    [word, setWord] = useState('');
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [clock, setClock] = useState(Date.now()),
    [offset, setOffset] = useState(0);
  const [draft, setDraft] = useState<Settings>(defaults),
    [copied, setCopied] = useState(false),
    [sound, setSound] = useState(true);
  const [reveal, setReveal] = useState<Submission | null>(null);
  const [colorblind, setColorblind] = useState(false);
  const [autocorrect, setAutocorrect] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const latestSubmission = useRef(''),
    soundRef = useRef(true),
    audio = useRef<GameSounds | null>(null),
    modal = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);
  function playSound(effect: SoundEffect) {
    if (!soundRef.current) return;
    audio.current ??= new GameSounds();
    audio.current.play(effect);
  }
  const previousState = useRef<RoomState | null>(null);
  useEffect(() => {
    setName(localStorage.getItem('cinammon-name') ?? '');
    const savedSound = localStorage.getItem('cinammon-sound') !== 'false';
    setSound(savedSound);
    soundRef.current = savedSound;
    setColorblind(localStorage.getItem('cinammon-colorblind') === 'true');
    setAutocorrect(localStorage.getItem('cinammon-autocorrect') !== 'false');
    try {
      identity.current = JSON.parse(sessionStorage.getItem('cinammon-session') ?? 'null');
    } catch {
      sessionStorage.removeItem('cinammon-session');
    }
    const invite = new URLSearchParams(location.search).get('room');
    if (invite && !identity.current) {
      setCode(invite.toUpperCase());
      setDialog('join');
    }
    const url =
      process.env.NEXT_PUBLIC_GAME_SERVER_URL || `${location.protocol}//${location.hostname}:3001`;
    const client = io(url, { autoConnect: false, reconnection: true });
    socket.current = client;
    client.on('connect', () => {
      setConnected(true);
      setError('');
      const saved = identity.current;
      if (saved)
        client.timeout(5000).emit('resume', saved, (err: Error | null, reply: Reply) => {
          if (err) {
            setError('Could not restore your room. Reconnect to try again.');
            return;
          }
          if (reply.ok) setMe(saved.playerId);
          else {
            identity.current = null;
            sessionStorage.removeItem('cinammon-session');
            setRoom(null);
            setMe('');
            setError(reply.error ?? 'Room expired.');
          }
        });
    });
    client.on('disconnect', (reason: string) => {
      previousState.current = null;
      setConnected(false);
      if (reason === 'io server disconnect') {
        identity.current = null;
        sessionStorage.removeItem('cinammon-session');
        setRoom(null);
        setError('This room session was opened in another tab. Refresh to join again.');
      }
    });
    client.on('connect_error', () => {
      setConnected(false);
    });
    client.on('state', (state: RoomState) => {
      const previous = previousState.current;
      const cue = stateSound(previous, state, identity.current?.playerId ?? '');
      previousState.current = state;
      if (cue) playSound(cue);
      setOffset(state.serverNow - Date.now());
      setRoom(state);
      const latest = state.history.at(-1);
      if (latest && latest.id !== latestSubmission.current) {
        latestSubmission.current = latest.id;
        if (previous && previous.matchId === state.matchId) setReveal(latest);
      }
    });
    client.on('typing', (draft: TypingUpdate) => {
      setRoom((current) =>
        current &&
        current.phase === 'playing' &&
        current.turnId === draft.turnId &&
        current.activeId === draft.playerId
          ? { ...current, typing: draft }
          : current,
      );
    });
    client.connect();
    const timer = setInterval(() => setClock(Date.now()), 100);
    return () => {
      clearInterval(timer);
      client.disconnect();
      socket.current = null;
      audio.current?.close();
      audio.current = null;
    };
  }, []);
  useEffect(() => {
    setWord(room?.activeId === me ? (room.typing?.word ?? '') : '');
    setError('');
    if (room?.activeId === me) input.current?.focus({ preventScroll: true });
  }, [room?.turnId, me]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [room?.phase]);
  useEffect(() => {
    if (!busy && connected && room?.mode === 'practice' && room.phase === 'playing')
      input.current?.focus({ preventScroll: true });
  }, [busy, connected, room?.mode, room?.phase, room?.turnId]);
  useEffect(() => {
    if (!reveal) return;
    const timer = setTimeout(() => setReveal(null), 2600);
    return () => clearTimeout(timer);
  }, [reveal]);
  useEffect(() => {
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() =>
      (
        modal.current?.querySelector<HTMLElement>('input') ??
        modal.current?.querySelector<HTMLElement>('button,select')
      )?.focus(),
    );
    function keyboard(event: KeyboardEvent) {
      if (event.key !== 'Tab') return;
      const items = Array.from(
        modal.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),summary',
        ) ?? [],
      ).filter((el) => el.getClientRects().length > 0);
      const first = items[0],
        last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener('keydown', keyboard);
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', keyboard);
      document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, [dialog]);
  function send(event: string, payload: unknown, done?: (reply: Reply) => void) {
    if (!socket.current?.connected) {
      setError('Connecting to the game server. Please try again shortly.');
      return;
    }
    setBusy(true);
    setError('');
    socket.current.timeout(5000).emit(event, payload, (err: Error | null, reply: Reply) => {
      setBusy(false);
      if (err) {
        setError('The server did not respond. Check your connection.');
        return;
      }
      if (!reply.ok) {
        playSound('invalid');
        setError(reply.error ?? 'Please try again.');
        if (event === 'submit') {
          setWord('');
          if (room) {
            setRoom((current) =>
              current && current.turnId === room.turnId
                ? { ...current, typing: { playerId: me, turnId: room.turnId, word: '' } }
                : current,
            );
            socket.current?.emit('typing', { word: '', turnId: room.turnId });
          }
        }
        input.current?.focus();
        return;
      }
      done?.(reply);
    });
  }
  function enter(event: FormEvent) {
    event.preventDefault();
    const action = dialog === 'join' ? 'join' : 'create';
    send(action, action === 'join' ? { name, code: parseRoomCode(code) } : { name }, (reply) => {
      const saved = { playerId: reply.playerId!, token: reply.token!, code: reply.code! };
      identity.current = saved;
      sessionStorage.setItem('cinammon-session', JSON.stringify(saved));
      localStorage.setItem('cinammon-name', name);
      setMe(saved.playerId);
      setDialog(null);
      if (action === 'create') send('settings', draft);
      history.replaceState(null, '', `?room=${saved.code}`);
    });
  }
  function startPractice() {
    send('practice', { name: name.trim() || 'You' }, (reply) => {
      const saved = { playerId: reply.playerId!, token: reply.token!, code: reply.code! };
      identity.current = saved;
      sessionStorage.setItem('cinammon-session', JSON.stringify(saved));
      setMe(saved.playerId);
      setDialog(null);
      setChatOpen(false);
      history.replaceState(null, '', `?room=${saved.code}`);
    });
  }
  function leave() {
    send('leave', {}, () => {
      identity.current = null;
      sessionStorage.removeItem('cinammon-session');
      setRoom(null);
      setMe('');
      setReveal(null);
      latestSubmission.current = '';
      previousState.current = null;
      history.replaceState(null, '', location.pathname);
    });
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (room) send('submit', { word, turnId: room.turnId, autocorrect }, () => setWord(''));
  }
  function editWord(value: string) {
    setWord(value);
    setError('');
    if (!room || room.activeId !== me || !socket.current?.connected) return;
    // Immediate local feedback; each edit is sent to the server for the others.
    setRoom((current) =>
      current && current.turnId === room.turnId
        ? { ...current, typing: { playerId: me, turnId: room.turnId, word: value } }
        : current,
    );
    socket.current.emit('typing', { word: value, turnId: room.turnId });
  }
  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(room?.code ?? '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(`Copy this room code: ${room?.code}`);
    }
  }
  const host = room?.hostId === me,
    player = room?.players.find((p) => p.id === me),
    active = room?.players.find((p) => p.id === room.activeId);
  const seconds = room
    ? Math.min(room.settings.turnSeconds, Math.max(0, (room.deadline - clock - offset) / 1000))
    : 0;
  const isTurn = room?.activeId === me && connected;
  const ranked = room
    ? [...room.players].sort(
        (a, b) => Number(!!a.eliminated) - Number(!!b.eliminated) || b.score - a.score,
      )
    : [];
  const longest = room?.history.reduce<Submission | null>(
    (best, item) =>
      !best ||
      (item.originalWord ?? item.word).replace(/[^a-z]/gi, '').length >
        (best.originalWord ?? best.word).replace(/[^a-z]/gi, '').length
        ? item
        : best,
    null,
  );
  const playingPlayers = room?.players.filter((p) => !p.eliminated) ?? [];
  const rarest = room?.history
    .filter((s) => s.zipf !== null)
    .reduce<Submission | null>(
      (best, item) => (!best || (item.zipf ?? 9) < (best.zipf ?? 9) ? item : best),
      null,
    );
  const winners = ranked.filter(
    (p) => !p.eliminated && p.score === ranked.find((p) => !p.eliminated)?.score,
  );
  return (
    <MotionConfig reducedMotion="user">
      <div
        className={`site-shell ${colorblind ? 'colorblind-mode' : ''} ${room?.mode !== 'practice' && room && chatOpen ? 'chat-expanded' : ''}`}
        onKeyDownCapture={(event) => {
          if (!event.repeat && (event.key === 'Enter' || event.key === ' ')) {
            audio.current ??= new GameSounds();
            audio.current.setEnabled(soundRef.current);
            audio.current.unlock();
          }
        }}
        onClickCapture={(event) => {
          audio.current ??= new GameSounds();
          audio.current.setEnabled(soundRef.current);
          audio.current.unlock();
          const button = (event.target as Element).closest('button:not(:disabled)');
          if (button && !button.hasAttribute('data-silent') && event.detail < 2) playSound('click');
        }}
      >
        <header className="nav">
          <a
            className="brand"
            href="/"
            onClick={(event) => {
              if (room) {
                event.preventDefault();
                setDialog(null);
              }
            }}
          >
            Cinnamon
          </a>
          <nav className="nav-menu" aria-label="Main navigation">
            <button
              className={`nav-tab ${!dialog ? 'selected' : ''}`}
              aria-current={!dialog ? 'page' : undefined}
              onClick={() => setDialog(null)}
            >
              Play
            </button>
            <button
              className={`nav-tab ${dialog === 'help' ? 'selected' : ''}`}
              onClick={() => setDialog('help')}
            >
              How to play
            </button>
            <button
              className={`nav-tab ${dialog === 'settings' ? 'selected' : ''}`}
              onClick={() => {
                if (room && room.mode !== 'practice') setDraft(room.settings);
                setDialog('settings');
              }}
            >
              Settings
            </button>
          </nav>
          <div className="nav-actions">
            <button
              aria-label={sound ? 'Mute sound' : 'Enable sound'}
              aria-pressed={!sound}
              data-silent
              className="icon-button"
              onClick={() => {
                const enabled = !sound;
                soundRef.current = enabled;
                audio.current?.setEnabled(enabled);
                setSound(enabled);
                localStorage.setItem('cinammon-sound', String(enabled));
                if (enabled) audio.current?.unlock();
              }}
            >
              {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            {room && (
              <button className="quiet-button" disabled={busy} onClick={leave}>
                <DoorOpen size={16} /> Leave
              </button>
            )}
          </div>
        </header>
        {room && !connected && (
          <div className="connection-banner">
            <WifiOff size={17} />{' '}
            {room.mode === 'practice'
              ? 'Reconnecting… restoring your practice session.'
              : 'Reconnecting… your seat is reserved. The server timer keeps running.'}
          </div>
        )}
        {room && room.mode !== 'practice' && (
          <RoomChat
            key={room.code}
            socket={socket.current}
            code={room.code}
            me={me}
            connected={connected}
            open={chatOpen}
            onToggle={() => setChatOpen((value) => !value)}
          />
        )}
        <main>
          {!room && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="home"
            >
              <div className="home-copy">
                <h1>Cinnamon</h1>
                <p className="home-description">Multiplayer word association game.</p>
                <div className="home-buttons">
                  <button
                    className="primary large"
                    onClick={() => {
                      setError('');
                      setDialog('create');
                    }}
                  >
                    Create room
                  </button>
                  <button
                    className="secondary large"
                    onClick={() => {
                      setError('');
                      setDialog('join');
                    }}
                  >
                    Join room
                  </button>
                  <button
                    className="solo-practice-button"
                    onClick={startPractice}
                    disabled={busy || !connected}
                  >
                    <span>
                      <strong>Solo practice</strong>
                    </span>
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
              <WordArt />
            </motion.div>
          )}
          {!room && (
            <footer className="legal-footer">
              <a href="/contact">Contact</a>
              <span aria-hidden="true">|</span>
              <a href="/privacy">Privacy</a>
              <span aria-hidden="true">|</span>
              <a href="/terms">Terms</a>
            </footer>
          )}
          {room?.phase === 'lobby' && (
            <motion.section
              className="lobby section"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="section-heading">
                <h1>Lobby</h1>
              </div>
              <div className="lobby-grid">
                <div className="paper players-card">
                  <div className="card-heading">
                    <h2>Players</h2>
                    <span>{room.players.length} / 8 players</span>
                  </div>
                  <div className="invite-row">
                    <div>
                      <span className="field-label">ROOM CODE</span>
                      <strong>{room.code}</strong>
                    </div>
                    <button className="secondary" onClick={copyInvite}>
                      {copied ? <Check size={16} /> : <Copy size={16} />}{' '}
                      {copied ? 'Copied' : 'Copy code'}
                    </button>
                  </div>
                  <div className="player-list">
                    {room.players.map((p, i) => (
                      <div className="player-row" key={p.id}>
                        <span className={`avatar avatar-${i % 4}`}>
                          <UserRound size={20} strokeWidth={1.5} />
                        </span>
                        <div className="player-name">
                          {p.name} {p.id === me && <small>you</small>}{' '}
                          {p.id === room.hostId && <Crown size={15} className="crown" />}
                        </div>
                        <span className={`readiness ${p.ready ? 'ready' : ''}`}>
                          {!p.connected ? (
                            'Reconnecting'
                          ) : p.ready ? (
                            <>
                              <Check size={14} /> Ready
                            </>
                          ) : (
                            'Not ready'
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                  {room.players.length < 2 && (
                    <div className="empty-seat">
                      <Users size={20} />
                      <span>
                        Waiting for another player.
                        <br />
                        <small>Share the room code or invite link.</small>
                      </span>
                    </div>
                  )}
                  <button
                    className={player?.ready ? 'secondary full' : 'primary full'}
                    disabled={busy || !connected}
                    onClick={() => send('ready', !player?.ready)}
                  >
                    {player?.ready ? (
                      <>
                        <Check size={18} /> Unready
                      </>
                    ) : (
                      <>
                        Ready <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                </div>
                <div className="lobby-side">
                  <div className="paper settings-card">
                    <div className="card-heading">
                      <h2>Game settings</h2>
                      <Settings2 size={18} />
                    </div>
                    <GameSettings
                      value={room.settings}
                      disabled={!host || busy}
                      onChange={(value) => send('settings', value)}
                    />
                  </div>
                  <div className="start-card">
                    {host ? (
                      <button
                        className="primary full"
                        disabled={
                          busy ||
                          !connected ||
                          room.players.length < 2 ||
                          room.players.some((p) => !p.connected || !p.ready)
                        }
                        onClick={() => send('start', {})}
                      >
                        Start game <ArrowRight size={18} />
                      </button>
                    ) : (
                      <span className="pill"></span>
                    )}
                  </div>
                </div>
              </div>
            </motion.section>
          )}
          {room?.phase === 'playing' && room.mode === 'practice' && (
            <PracticeGame
              room={room}
              word={word}
              error={error}
              busy={busy}
              connected={connected}
              inputRef={input}
              onEdit={editWord}
              onSubmit={submit}
              score={<ScoreCounter score={player?.score ?? 0} />}
              seconds={seconds}
              reveal={reveal}
              rarityReveal={
                <AnimatePresence>
                  {reveal && <RarityReveal key={reveal.id} submission={reveal} />}
                </AnimatePresence>
              }
              onNext={() =>
                send('practice:next', { turnId: room.turnId }, () => {
                  setReveal(null);
                  setWord('');
                })
              }
            />
          )}
          {room?.phase === 'playing' && room.mode !== 'practice' && (
            <section className="game section">
              <div className="game-topline">
                <span>Room {room.code}</span>
                <span>
                  Prompt {room.round} / {room.settings.rounds}
                </span>
              </div>
              <div className="player-circle" aria-label="Players around the prompt">
                <div className="circle-outline" aria-hidden="true" />
                {playingPlayers.map((p, index) => {
                  const angle =
                    (index / playingPlayers.length) * Math.PI * 2 -
                    (playingPlayers.length === 2 ? Math.PI : Math.PI / 2);
                  const lastWord = room.history.findLast(
                    (s) => s.playerId === p.id && s.prompt === room.prompt,
                  );
                  const draftWord =
                    room.typing?.playerId === p.id && room.typing.turnId === room.turnId
                      ? room.typing.word
                      : null;
                  return (
                    <div
                      key={p.id}
                      className={`circle-player ${p.id === room.activeId ? 'current-player' : ''} ${!p.connected ? 'disconnected-player' : ''}`}
                      style={{
                        left: `${50 + 36 * Math.cos(angle)}%`,
                        top: `${50 + 36 * Math.sin(angle)}%`,
                      }}
                      aria-label={`${p.name}${p.id === room.activeId ? ', current turn' : ''}, ${p.score} points${lastWord ? `, played ${lastWord.word}` : ''}`}
                    >
                      <div className="player-answer" aria-live="polite">
                        {draftWord !== null ? (
                          <DraftWord word={draftWord} name={p.name} />
                        ) : (
                          lastWord && (
                            <motion.span
                              key={lastWord.id}
                              className={`tier-tag tier-${lastWord.tierIndex}`}
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                            >
                              {lastWord.word}
                            </motion.span>
                          )
                        )}
                      </div>
                      <span className={`person-icon person-${index % 8}`}>
                        <UserRound size={30} strokeWidth={1.5} />
                        <span className="player-number" aria-hidden="true">
                          {index + 1}
                        </span>
                      </span>
                      <strong className="circle-name">
                        {p.name}
                        {p.id === me && <small> (you)</small>}
                      </strong>
                      <ScoreCounter score={p.score} />
                      <AnimatePresence>
                        {reveal?.playerId === p.id && (
                          <motion.span
                            key={reveal.id}
                            className={`score-gain tier-${reveal.tierIndex}`}
                            initial={{ opacity: 0, y: 8, scale: 0.8 }}
                            animate={{ opacity: [0, 1, 1, 0], y: -42, scale: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 2 }}
                          >
                            +{reveal.points}
                          </motion.span>
                        )}
                      </AnimatePresence>
                      {!p.connected && <small className="offline-label">Offline</small>}
                    </div>
                  );
                })}
                <div className="circle-center">
                  <AnimatePresence mode="wait">
                    <motion.h1
                      className="prompt-title"
                      style={{
                        fontSize: `clamp(15px, ${Math.min(4.7, 38 / room.prompt.length)}vw, ${Math.min(54, 280 / room.prompt.length)}px)`,
                      }}
                      key={room.prompt}
                      initial={{ opacity: 0, scale: 0.92, filter: 'blur(5px)' }}
                      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, scale: 1.05 }}
                    >
                      {room.prompt}
                    </motion.h1>
                  </AnimatePresence>
                  <div
                    className={`circle-timer ${seconds <= 5 ? 'urgent' : ''}`}
                    aria-label={`${Math.ceil(seconds)} seconds remaining`}
                  >
                    {Math.ceil(seconds)}
                    <small>s</small>
                  </div>
                  <motion.div
                    className="turn-label"
                    key={room.turnId}
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {isTurn ? 'Your turn' : `${active?.name}’s turn`}
                  </motion.div>
                </div>
              </div>
              <div className="answer-controls">
                <form
                  onSubmit={submit}
                  className={`word-form ${isTurn ? 'your-turn' : ''} ${error ? 'answer-invalid' : ''}`}
                >
                  <input
                    ref={input}
                    aria-label="Your related word"
                    value={word}
                    onChange={(e) => editWord(e.target.value)}
                    placeholder={isTurn ? 'Enter a related word' : 'Wait for your turn'}
                    disabled={!isTurn || busy}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={32}
                  />
                  <button
                    type="submit"
                    aria-label="Submit word"
                    disabled={!isTurn || busy || !word.trim()}
                  >
                    <ArrowRight size={22} />
                  </button>
                </form>
                <div className="game-feedback" role="status" aria-live="polite">
                  {error ? (
                    <motion.p
                      key={error}
                      initial={{ x: -4 }}
                      animate={{ x: [-4, 4, 0] }}
                      className="error"
                    >
                      {error}
                    </motion.p>
                  ) : (
                    room.lastEvent?.message
                  )}
                </div>
                <div className="reveal-slot">
                  <AnimatePresence>
                    {reveal && <RarityReveal key={reveal.id} submission={reveal} />}
                  </AnimatePresence>
                </div>
                {room.used.length > 0 && (
                  <div className="played-words" aria-label="Words already played">
                    <span>Played:</span>
                    {room.used.map((w) => (
                      <span key={w}>{w}</span>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}
          {room?.phase === 'results' && room.mode === 'practice' && (
            <motion.section
              className="results section practice-results"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <h1>Practice complete</h1>
              <div className="final-reveal">
                <AnimatePresence>
                  {reveal && <RarityReveal key={reveal.id} submission={reveal} />}
                </AnimatePresence>
              </div>
              <p>
                {room.history.length} words accepted · {room.round}{' '}
                {room.round === 1 ? 'prompt' : 'prompts'} explored
              </p>
              <div className="practice-final-score">
                <span>Total score</span>
                <ScoreCounter score={player?.score ?? 0} />
              </div>
              <div className="results-grid">
                <Highlight label="RAREST WORD" submission={rarest} room={room} />
                <Highlight label="LONGEST WORD" submission={longest} room={room} longest />
              </div>
              <div className="results-actions">
                <button
                  className="primary large"
                  disabled={busy || !connected}
                  onClick={() => send('rematch', {}, () => setReveal(null))}
                >
                  <RotateCcw size={18} />
                  Practice again
                </button>
                <button className="secondary large" disabled={busy} onClick={leave}>
                  Back to home
                </button>
              </div>
            </motion.section>
          )}
          {room?.phase === 'results' && room.mode !== 'practice' && (
            <motion.section
              className="results section"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="winner-symbol">
                <Trophy size={30} />
              </div>
              <h1>{winners.length > 1 ? 'Tie' : `${winners[0]?.name} wins`}</h1>
              <p>
                {winners.length > 1
                  ? `${winners.map((p) => p.name).join(' & ')} share first place.`
                  : room.lastEvent?.message?.startsWith('Game ended:')
                    ? room.lastEvent.message
                    : 'Game over'}
              </p>
              <div className="final-reveal">
                <AnimatePresence>
                  {reveal && <RarityReveal key={reveal.id} submission={reveal} />}
                </AnimatePresence>
              </div>
              <div className="results-grid">
                <div className="paper leaderboard">
                  <div className="card-heading">
                    <h2>Scores</h2>
                    <span>{room.settings.rounds} prompts</span>
                  </div>
                  {ranked.map((p, i) => (
                    <div
                      className={`leader-row ${!p.eliminated && p.score === ranked[0].score ? 'winner-row' : ''}`}
                      key={p.id}
                    >
                      <span className="place">
                        {ranked.findIndex((other) => other.score === p.score) + 1}
                      </span>
                      <span className={`avatar avatar-${i % 4}`}>
                        <UserRound size={20} strokeWidth={1.5} />
                      </span>
                      <strong>
                        {p.name}
                        {p.eliminated && <small> (left)</small>}
                        {p.id === me && <small> you</small>}
                      </strong>
                      {!p.eliminated && p.score === ranked[0].score && <Crown size={18} />}
                      <b>{p.score}</b>
                    </div>
                  ))}
                </div>
                <div className="highlights">
                  <Highlight label="RAREST WORD" submission={rarest} room={room} />
                  <Highlight label="LONGEST WORD" submission={longest} room={room} longest />
                </div>
              </div>
              <div className="results-actions">
                {host ? (
                  <button
                    className="primary large"
                    onClick={() => send('rematch', {})}
                    disabled={busy}
                  >
                    <RotateCcw size={18} /> Play again
                  </button>
                ) : (
                  <span className="pill">Waiting for host</span>
                )}
                <button className="secondary large" onClick={leave} disabled={busy}>
                  Back to home
                </button>
              </div>
              <p className="persistence-note">
                {room.persistence === 'saved'
                  ? 'Match saved.'
                  : room.persistence === 'pending'
                    ? 'Saving match…'
                    : room.persistence === 'failed'
                      ? 'Match could not be saved. Your results remain here until the room closes.'
                      : ''}
              </p>
            </motion.section>
          )}
          {error && room?.phase !== 'playing' && (
            <div className="error global-error" role="alert">
              {error}
            </div>
          )}
        </main>
        <AnimatePresence>
          {dialog && (
            <motion.div
              className="modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                ref={modal}
                className="modal paper"
                role="dialog"
                aria-modal="true"
                aria-labelledby="dialog-title"
                initial={{ scale: 0.97, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  className="icon-button modal-close"
                  aria-label="Close dialog"
                  onClick={() => setDialog(null)}
                >
                  <X size={20} />
                </button>
                {(dialog === 'create' || dialog === 'join') && (
                  <>
                    <h2 id="dialog-title">{dialog === 'create' ? 'Create room' : 'Join room'}</h2>
                    <p>{dialog === 'create' ? '2–8 players' : 'Enter the room code.'}</p>
                    <form onSubmit={enter}>
                      <label>
                        Your name
                        <input
                          autoFocus
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          placeholder="Display name"
                          maxLength={20}
                          required
                        />
                      </label>
                      {dialog === 'join' && (
                        <label>
                          Room code
                          <input
                            className="code-input"
                            value={code}
                            onChange={(event) => setCode(parseRoomCode(event.target.value))}
                            maxLength={200}
                            minLength={6}
                            placeholder="ABC234"
                            required
                          />
                        </label>
                      )}
                      <button className="primary full" disabled={busy || !connected}>
                        {busy ? 'Connecting…' : dialog === 'create' ? 'Create room' : 'Join room'}{' '}
                        <ArrowRight size={18} />
                      </button>
                    </form>
                    {!connected && <p className="settings-note">Connecting to the game server…</p>}
                  </>
                )}
                {dialog === 'help' && (
                  <>
                    <h2 id="dialog-title">How to play</h2>
                    <ol className="how-to">
                      <li>
                        On your turn, enter an English word related to the prompt before the timer
                        ends.
                      </li>
                      <li>
                        Words cannot repeat within the same prompt. Plurals and tense changes count
                        as the same word.
                      </li>
                      <li>
                        Rarer words earn more points. Invalid answers can be retried while time
                        remains.
                      </li>
                      <li>
                        The prompt changes after everyone’s turns. The highest total score wins.
                      </li>
                    </ol>
                    <h3 className="categories-heading">Point categories</h3>
                    <p className="help-note">
                      In solo practice, click the prompt to change it. Use Leave to return home.
                    </p>
                    <div className="point-categories" role="list" aria-label="Point categories">
                      {TIER_NAMES.map((tier, index) => (
                        <div className={`point-category tier-${index}`} key={tier} role="listitem">
                          <span className="tier-symbol" aria-hidden="true">
                            {index + 1}
                          </span>
                          <strong>{tier}</strong>
                          <b>{room?.settings.points[index] ?? POINTS[index]}</b>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {dialog === 'settings' && (
                  <>
                    <h2 id="dialog-title">Settings</h2>
                    <label className="colorblind-control">
                      Colorblind mode
                      <input
                        type="checkbox"
                        role="switch"
                        checked={colorblind}
                        onChange={(event) => {
                          setColorblind(event.target.checked);
                          localStorage.setItem('cinammon-colorblind', String(event.target.checked));
                        }}
                      />
                      <span aria-hidden="true" className="switch-track" />
                    </label>
                    <label className="colorblind-control">
                      Autocorrection
                      <input
                        type="checkbox"
                        role="switch"
                        checked={autocorrect}
                        onChange={(event) => {
                          setAutocorrect(event.target.checked);
                          localStorage.setItem(
                            'cinammon-autocorrect',
                            String(event.target.checked),
                          );
                        }}
                      />
                      <span aria-hidden="true" className="switch-track" />
                    </label>
                    {room?.mode !== 'practice' && (
                      <GameSettings
                        value={draft}
                        disabled={!!room && (!host || room.phase !== 'lobby')}
                        onChange={(settings) => {
                          setDraft(settings);
                          if (room) send('settings', settings);
                        }}
                      />
                    )}
                  </>
                )}
                {error && (
                  <p className="error" role="alert">
                    {error}
                  </p>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
function DraftWord({ word, name }: { word: string; name: string }) {
  const label = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    function fit() {
      const node = label.current;
      if (!node) return;
      node.style.fontSize = '';
      node.style.transform = '';
      const available = document.documentElement.clientWidth - 24;
      let rect = node.getBoundingClientRect();
      if (rect.width > available)
        node.style.fontSize = `${(parseFloat(getComputedStyle(node).fontSize) * available) / rect.width}px`;
      rect = node.getBoundingClientRect();
      const shift =
        rect.left < 12
          ? 12 - rect.left
          : rect.right > available + 12
            ? available + 12 - rect.right
            : 0;
      node.style.transform = `translateX(${shift}px)`;
    }
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [word]);
  return (
    <span
      ref={label}
      className="draft-word"
      aria-label={`${name} is typing ${word || 'an answer'}`}
    >
      {word || <span className="typing-caret" aria-hidden="true" />}
    </span>
  );
}
function GameSettings({
  value,
  onChange,
  disabled,
}: {
  value: Settings;
  onChange: (value: Settings) => void;
  disabled?: boolean;
}) {
  return (
    <div className="game-settings">
      <label>
        Turn time
        <select
          disabled={disabled}
          value={value.turnSeconds}
          onChange={(e) => onChange({ ...value, turnSeconds: Number(e.target.value) })}
        >
          {[5, 10, 15, 20, 30, 45, 60].map((n) => (
            <option key={n} value={n}>
              {n} seconds
            </option>
          ))}
        </select>
      </label>
      <label>
        Turns per prompt
        <select
          disabled={disabled}
          value={value.turnsPerPrompt}
          onChange={(e) => onChange({ ...value, turnsPerPrompt: Number(e.target.value) })}
        >
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>
              {n} each
            </option>
          ))}
        </select>
      </label>
      <label>
        Number of prompts
        <select
          disabled={disabled}
          value={value.rounds}
          onChange={(e) => onChange({ ...value, rounds: Number(e.target.value) })}
        >
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <option key={n} value={n}>
              {n} prompts
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
function RarityReveal({ submission }: { submission: Submission }) {
  return (
    <motion.div
      className={`rarity-reveal tier-surface-${submission.tierIndex}`}
      initial={{ opacity: 0, scale: 0.9, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      role="status"
    >
      <strong>{submission.word}</strong>
      <span>{submission.tier}</span>
      <b>+{submission.points}</b>
    </motion.div>
  );
}

function Highlight({
  label,
  submission,
  room,
  longest = false,
}: {
  longest?: boolean;
  label: string;
  submission: Submission | null | undefined;
  room: RoomState;
}) {
  return (
    <div className="paper highlight">
      <span className="field-label">{label}</span>
      <h3>
        {submission
          ? longest
            ? (submission.originalWord ?? submission.word)
            : submission.word
          : '—'}
      </h3>
      {submission ? (
        <>
          <span className={`tier-tag tier-${submission.tierIndex}`}>
            {longest
              ? `${(submission.originalWord ?? submission.word).replace(/[^a-z]/gi, '').length} letters`
              : `${submission.tier} · +${submission.points}`}
          </span>
          <p>
            {room.players.find((p) => p.id === submission.playerId)?.name} ·{' '}
            <em>{submission.prompt}</em>.
          </p>
        </>
      ) : (
        <p>No accepted words.</p>
      )}
    </div>
  );
}

function ScoreCounter({ score }: { score: number }) {
  const node = useRef<HTMLSpanElement>(null);
  const previous = useRef(score);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    const from = previous.current;
    previous.current = score;
    if (reduceMotion || from === score) {
      if (node.current) node.current.textContent = String(score);
      return;
    }
    const controls = animate(from, score, {
      duration: 0.7,
      ease: 'easeOut',
      onUpdate: (value) => {
        if (node.current) node.current.textContent = String(Math.round(value));
      },
    });
    return () => controls.stop();
  }, [score, reduceMotion]);
  return (
    <span className="circle-score" aria-label={`${score} points`} ref={node}>
      {score}
    </span>
  );
}
