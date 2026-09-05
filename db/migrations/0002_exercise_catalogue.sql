-- Phase 2 · exercise catalogue
-- Seeded from the vendored free-exercise-db-with-videos snapshot
-- (src/data/exercises.json) by scripts/seed-exercises.mjs.
--
-- This is GLOBAL reference data, not user data — it carries no user_id and is
-- readable by the whole app. It is only ever written by the seed script.
--
-- Media lives in its own table so exercise identity never depends on a single
-- external URL — the current videos are hosted on a third-party R2 bucket and
-- must be mirrorable without touching exercise rows or foreign keys.

create table if not exists public.exercise_cache (
  id                  text primary key,
  provider            text not null default 'free-exercise-db-with-videos',
  name                text not null,
  aliases             jsonb not null default '[]'::jsonb,
  body_part           text not null,
  target              text not null,
  secondary_muscles   jsonb not null default '[]'::jsonb,
  equipment           text not null,
  difficulty          text not null check (difficulty in (
                        'beginner', 'intermediate', 'advanced')),
  compound            boolean not null default false,
  unilateral          boolean not null default false,
  short_description   text,
  instructions        text,
  steps               jsonb not null default '[]'::jsonb,
  form_cues           jsonb not null default '[]'::jsonb,
  common_mistakes     jsonb not null default '[]'::jsonb,
  breathing           text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Filter facets used by the library (Phase 3) and candidate selection (Phase 4).
create index if not exists exercise_cache_body_part_idx  on public.exercise_cache (body_part);
create index if not exists exercise_cache_target_idx     on public.exercise_cache (target);
create index if not exists exercise_cache_equipment_idx  on public.exercise_cache (equipment);
create index if not exists exercise_cache_difficulty_idx on public.exercise_cache (difficulty);

create trigger exercise_cache_set_updated_at
  before update on public.exercise_cache
  for each row execute function public.set_updated_at();

create table if not exists public.exercise_media (
  exercise_id text not null references public.exercise_cache (id) on delete cascade,
  kind        text not null check (kind in ('video', 'thumbnail')),
  sex         text not null check (sex in ('male', 'female')),
  url         text not null,
  provider    text not null default 'r2-free-exercise-db',
  created_at  timestamptz not null default now(),
  primary key (exercise_id, kind, sex)
);

create index if not exists exercise_media_exercise_id_idx
  on public.exercise_media (exercise_id);
