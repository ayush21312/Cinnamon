import { it, expect } from 'vitest';
import { parseRoomCode } from '../lib/room-code';
it('accepts short copied codes and full invitation URLs without truncating to https', () => {
  expect(parseRoomCode(' abc234 ')).toBe('ABC234');
  expect(parseRoomCode('https://cinammon.gg/?room=ABC234')).toBe('ABC234');
  expect(parseRoomCode('http://localhost:3000/?room=abc234')).toBe('ABC234');
});
