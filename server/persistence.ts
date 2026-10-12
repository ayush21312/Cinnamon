import { createClient } from '@supabase/supabase-js';
import type { RoomState } from '../lib/types';
export function resultStore() {
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return async (state: RoomState) => {
    // One atomic, idempotent record. Guests are match-scoped; no pretend accounts.
    const { error } = await db.from('matches').upsert(
      {
        id: state.matchId,
        room_code: state.code,
        finished_at: new Date().toISOString(),
        settings: state.settings,
        participants: state.players.map(({ id, name, score }) => ({ id, name, score })),
        submissions: state.history,
      },
      { onConflict: 'id' },
    );
    if (error) throw error;
  };
}
