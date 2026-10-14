import type { RoomState } from './types';
import type { SoundEffect } from './sounds';
export function stateSound(
  previous: RoomState | null,
  next: RoomState,
  me: string,
): SoundEffect | null {
  // Joining/reconnecting must not replay historical answers or game endings.
  if (!previous || previous.code !== next.code) return null;
  if (previous.matchId !== next.matchId)
    return previous.phase === 'lobby' && next.phase === 'playing' && next.activeId === me
      ? 'turn'
      : null;
  if (next.phase === 'results' && previous.phase !== 'results') return 'finish';
  const latest = next.history.at(-1);
  if (latest && latest.id !== previous.history.at(-1)?.id) return 'accepted';
  if (next.phase === 'playing' && next.activeId === me && next.turnId !== previous.turnId)
    return 'turn';
  return null;
}
