-- Phase 10 · weekly check-in
--
-- One short subjective snapshot per week: how it felt, not what happened —
-- the objective side (workouts done, volume, weights) is already in the
-- workout tables and gets computed, never asked. The summary column holds a
-- compact machine-built digest that program generation feeds to the model.

create table if not exists public.weekly_checkins (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null,
  week_start    date not null,
  weight_kg     numeric(5,2) check (weight_kg between 20 and 400),
  workouts_done integer not null default 0,
  energy        text not null check (energy in ('low', 'ok', 'high')),
  sleep         text not null check (sleep in ('poor', 'ok', 'good')),
  soreness      text not null check (soreness in ('none', 'some', 'high')),
  difficulty    text not null check (difficulty in ('too_easy', 'right', 'too_hard')),
  liked         text,
  disliked      text,
  notes         text,
  summary       text not null,
  created_at    timestamptz not null default now(),
  unique (user_id, week_start)
);

create index if not exists weekly_checkins_user_idx
  on public.weekly_checkins (user_id, week_start desc);
