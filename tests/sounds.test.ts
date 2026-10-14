import { describe, expect, it, vi } from 'vitest';
import { GameSounds } from '../lib/sounds';
import { stateSound } from '../lib/game-feedback';
import { GameRoom } from '../server/engine';

function audioFixture() {
  const voices: { stop: ReturnType<typeof vi.fn>; start: ReturnType<typeof vi.fn> }[] = [];
  const context = {
    state: 'running',
    currentTime: 0,
    destination: {},
    resume: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    createOscillator: () => {
      const voice = {
        frequency: { value: 0 },
        type: 'sine',
        connect: vi.fn(),
        disconnect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        onended: null,
      };
      voices.push(voice);
      return voice;
    },
    createGain: () => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
    }),
  };
  const factory = vi.fn(() => context as unknown as AudioContext);
  return { audio: new GameSounds(factory), context, voices, factory };
}
describe('sound control', () => {
  it('suppresses rapid double clicks but allows a later click', () => {
    const { audio, context, voices } = audioFixture();
    expect(audio.play('click')).toBe(true);
    context.currentTime = 0.1;
    expect(audio.play('click')).toBe(false);
    expect(voices).toHaveLength(1);
    context.currentTime = 0.2;
    expect(audio.play('click')).toBe(true);
  });
  it('mute stops even scheduled notes, blocks playback, and unmute is silent', () => {
    const { audio, voices } = audioFixture();
    audio.play('finish');
    expect(voices).toHaveLength(4);
    audio.setEnabled(false);
    expect(voices.every((voice) => voice.stop.mock.calls.length === 2)).toBe(true);
    expect(audio.play('invalid')).toBe(false);
    audio.setEnabled(true);
    expect(voices).toHaveLength(4);
  });
  it('answer feedback replaces clicks and cannot be interrupted by another click', () => {
    const { audio, voices } = audioFixture();
    audio.play('click');
    expect(audio.play('invalid')).toBe(true);
    expect(voices[0].stop).toHaveBeenCalledTimes(2);
    expect(voices).toHaveLength(3);
    expect(audio.play('click')).toBe(false);
    expect(audio.play('turn')).toBe(false);
  });
  it('never creates an audio context when muted or queues blocked cues', () => {
    const { audio, factory, context, voices } = audioFixture();
    audio.setEnabled(false);
    audio.unlock();
    expect(audio.play('accepted')).toBe(false);
    expect(factory).not.toHaveBeenCalled();
    audio.setEnabled(true);
    context.state = 'suspended';
    expect(audio.play('accepted')).toBe(false);
    audio.unlock();
    context.state = 'running';
    expect(voices).toHaveLength(0);
    audio.close();
    expect(context.close).toHaveBeenCalledOnce();
  });
});
describe('synchronized game cues', () => {
  function fixture() {
    const room = new GameRoom('ABC234');
    const a = room.join('Ada', 'a'),
      b = room.join('Ben', 'b');
    room.ready(a.playerId, true);
    room.ready(b.playerId, true);
    const lobby = structuredClone(room.state);
    room.start(a.playerId, ['ocean']);
    return { room, a, lobby, started: structuredClone(room.state) };
  }
  it('announces the local first turn and ignores identical snapshots', () => {
    const { a, lobby, started } = fixture();
    expect(stateSound(lobby, started, a.playerId)).toBe('turn');
    expect(stateSound(started, started, a.playerId)).toBeNull();
  });
  it('plays accepted once, prioritizes finish, and does not replay on reconnect', () => {
    const { room, a, started } = fixture();
    room.submit(a.playerId, 'coral', room.state.turnId);
    const accepted = structuredClone(room.state);
    expect(stateSound(started, accepted, a.playerId)).toBe('accepted');
    expect(stateSound(accepted, accepted, a.playerId)).toBeNull();
    expect(stateSound(null, accepted, a.playerId)).toBeNull();
    const final = { ...accepted, phase: 'results' as const };
    expect(stateSound(started, final, a.playerId)).toBe('finish');
    expect(stateSound(final, final, a.playerId)).toBeNull();
    expect(stateSound(null, final, a.playerId)).toBeNull();
  });
});
