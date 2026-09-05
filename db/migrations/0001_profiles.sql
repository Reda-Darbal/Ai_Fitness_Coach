-- Phase 2 · user profiles
--
-- user_id is the Clerk `sub` claim (TEXT, e.g. "user_2ab..."), never a UUID.
--
-- Authorization is enforced in the application, not the database: Neon has no
-- RLS-with-JWT story we trust yet, so every repository function in
-- src/lib/db/ takes userId as its first parameter and filters on it. See
-- src/lib/db/session.ts for the rules. The user_id column is kept on every
-- table so Postgres RLS policies can be layered on later without migrating
-- any data.

-- Shared updated_at trigger (search_path pinned so the function cannot be
-- hijacked by a malicious schema on the search path).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  user_id                 text primary key,
  display_name            text,

  -- Basics
  age                     integer check (age between 13 and 100),
  sex                     text check (sex in ('male', 'female', 'other')),
  height_cm               numeric(5,1) check (height_cm between 100 and 250),
  current_weight_kg       numeric(5,2) check (current_weight_kg between 30 and 300),
  target_weight_kg        numeric(5,2) check (target_weight_kg between 30 and 300),

  -- Goal + experience
  goal                    text not null check (goal in (
                            'gain_muscle', 'gain_weight', 'strength',
                            'fat_loss', 'general_fitness')),
  experience_level        text not null check (experience_level in (
                            'beginner', 'intermediate', 'advanced')),

  -- Schedule
  training_days           text[] not null default '{}',
  preferred_time          text check (preferred_time in (
                            'morning', 'afternoon', 'evening', 'flexible')),
  session_minutes         integer check (session_minutes between 15 and 240),

  -- Equipment: values match the exercise catalogue's `equipment` facet
  -- (band, barbell, body weight, cable, dumbbell, ...) so Phase 4 can filter
  -- candidates directly without a translation layer.
  equipment               text[] not null default '{}',

  -- Preferences
  injuries                text,
  liked_exercises         text,
  disliked_exercises      text,
  notes                   text,

  -- Coach settings
  coach_language          text not null default 'en'
                            check (coach_language in ('ar', 'en', 'fr')),
  concise_replies         boolean not null default true,
  unit_preference         text not null default 'metric'
                            check (unit_preference in ('metric', 'imperial')),

  onboarding_completed_at timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  -- Training days must be real weekday names, and at least one once onboarded.
  constraint profiles_training_days_valid check (
    training_days <@ array['monday','tuesday','wednesday','thursday',
                           'friday','saturday','sunday']::text[]
  )
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
