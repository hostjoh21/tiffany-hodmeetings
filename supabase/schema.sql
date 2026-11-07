-- Run once in the Supabase SQL editor.
create table if not exists public.meeting_agendas (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  meeting_date  date not null,
  start_time    text not null,
  venue         text,
  recap         text,
  items         jsonb not null,
  participants  jsonb not null default '[]'::jsonb,
  recipient     text not null,
  status        text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error         text,
  sent_at       timestamptz
);

-- Only the server (service role key) reads and writes this table.
-- With RLS on and no policies, the public anon key cannot touch it.
alter table public.meeting_agendas enable row level security;

-- Already ran an earlier version of this file? Run this line once:
alter table public.meeting_agendas add column if not exists participants jsonb not null default '[]'::jsonb;

create index if not exists meeting_agendas_date_idx
  on public.meeting_agendas (meeting_date desc);
