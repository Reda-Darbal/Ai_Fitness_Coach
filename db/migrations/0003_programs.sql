-- Phase 4 · AI-generated training programs
--
-- The AI never invents exercises: program_exercises.exercise_id is a foreign
-- key into exercise_cache, so an id the model hallucinated cannot be stored
-- even if it survives validation. Generation attempts are logged to
-- ai_generations for cost, audit and debugging.

create table if not exists public.programs (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null,
  title         text not null,
  status        text not null default 'active'
                  check (status in ('draft', 'active', 'archived')),
  goal          text not null,
  weeks         integer not null default 1 check (weeks between 1 and 52),
  notes         text,
  generation_id uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists programs_user_idx on public.programs (user_id, status);

create trigger programs_set_updated_at
  before update on public.programs
  for each row execute function public.set_updated_at();

create table if not exists public.program_days (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  program_id  uuid not null references public.programs (id) on delete cascade,
  weekday     text not null check (weekday in (
                'monday','tuesday','wednesday','thursday',
                'friday','saturday','sunday')),
  order_index integer not null,
  name        text not null,
  focus       text,
  estimated_minutes integer check (estimated_minutes between 10 and 240),
  notes       text,
  created_at  timestamptz not null default now(),
  unique (program_id, weekday)
);

create index if not exists program_days_user_idx on public.program_days (user_id);
create index if not exists program_days_program_idx on public.program_days (program_id, order_index);

create table if not exists public.program_exercises (
  id              uuid primary key default gen_random_uuid(),
  user_id         text not null,
  program_day_id  uuid not null references public.program_days (id) on delete cascade,
  exercise_id     text not null references public.exercise_cache (id),
  order_index     integer not null,
  sets            integer not null check (sets between 1 and 10),
  rep_min         integer not null check (rep_min between 1 and 100),
  rep_max         integer not null check (rep_max between 1 and 100),
  rest_seconds    integer not null check (rest_seconds between 15 and 600),
  notes           text,
  created_at      timestamptz not null default now(),
  constraint program_exercises_rep_range check (rep_max >= rep_min)
);

create index if not exists program_exercises_user_idx on public.program_exercises (user_id);
create index if not exists program_exercises_day_idx on public.program_exercises (program_day_id, order_index);

create table if not exists public.ai_generations (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  kind        text not null check (kind in (
                'program', 'checkin', 'photo_review', 'chat')),
  model       text not null,
  status      text not null check (status in ('ok', 'invalid', 'error')),
  prompt      jsonb,
  response    jsonb,
  error       text,
  latency_ms  integer,
  created_at  timestamptz not null default now()
);

create index if not exists ai_generations_user_idx
  on public.ai_generations (user_id, created_at desc);
