-- Phase 5/6 · workout sessions and set logging
--
-- One row per training session, per exercise in it, and per set performed.
-- Sets are the atomic record: everything later (progressive overload, volume,
-- personal records, the coach's memory of what you lifted) is derived from
-- workout_sets rather than stored again.

create table if not exists public.workout_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         text not null,
  program_day_id  uuid references public.program_days (id) on delete set null,
  title           text not null,
  started_at      timestamptz not null default now(),
  completed_at    timestamptz,
  -- How the session felt overall, filled in when finishing.
  feeling         text check (feeling in ('easy', 'good', 'hard')),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists workout_sessions_user_idx
  on public.workout_sessions (user_id, started_at desc);

-- At most one session in progress per user, enforced by the database rather
-- than by hoping the UI never double-taps.
create unique index if not exists workout_sessions_one_active
  on public.workout_sessions (user_id)
  where completed_at is null;

create trigger workout_sessions_set_updated_at
  before update on public.workout_sessions
  for each row execute function public.set_updated_at();

create table if not exists public.workout_exercises (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,
  session_id   uuid not null references public.workout_sessions (id) on delete cascade,
  exercise_id  text not null references public.exercise_cache (id),
  order_index  integer not null,
  target_sets  integer not null default 3 check (target_sets between 1 and 10),
  target_rep_min integer not null default 8,
  target_rep_max integer not null default 12,
  rest_seconds integer not null default 90,
  skipped      boolean not null default false,
  -- Why the set felt the way it did; 'pain' also triggers the safety response.
  feedback     text check (feedback in ('too_easy', 'ok', 'too_hard', 'pain')),
  substituted_from text references public.exercise_cache (id),
  notes        text,
  created_at   timestamptz not null default now()
);

create index if not exists workout_exercises_session_idx
  on public.workout_exercises (session_id, order_index);
create index if not exists workout_exercises_user_exercise_idx
  on public.workout_exercises (user_id, exercise_id);

create table if not exists public.workout_sets (
  id                  uuid primary key default gen_random_uuid(),
  user_id             text not null,
  workout_exercise_id uuid not null
                        references public.workout_exercises (id) on delete cascade,
  set_index           integer not null,
  weight_kg           numeric(6,2) check (weight_kg >= 0 and weight_kg <= 1000),
  reps                integer check (reps between 0 and 200),
  is_warmup           boolean not null default false,
  completed_at        timestamptz not null default now(),
  unique (workout_exercise_id, set_index)
);

create index if not exists workout_sets_user_idx on public.workout_sets (user_id);
create index if not exists workout_sets_exercise_idx
  on public.workout_sets (workout_exercise_id, set_index);
