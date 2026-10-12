-- Run in Supabase SQL editor or your migration pipeline. Server service role only.
create table if not exists public.matches (
 id uuid primary key,
 room_code text not null,
 finished_at timestamptz not null default now(),
 settings jsonb not null,
 participants jsonb not null,
 submissions jsonb not null,
 constraint participants_array check (jsonb_typeof(participants) = 'array'),
 constraint submissions_array check (jsonb_typeof(submissions) = 'array')
);
create index if not exists matches_finished_at_idx on public.matches (finished_at desc);
alter table public.matches enable row level security;
revoke all on public.matches from anon, authenticated;
-- No public policies: only the backend service role may store or read guest matches.
