export function parseRoomCode(input: string) {
  const value = input.trim();
  // Accept either the copied six-character code or a full invitation URL.
  try {
    const url = new URL(value);
    return (url.searchParams.get('room') ?? value).trim().toUpperCase();
  } catch {
    return value.toUpperCase();
  }
}
