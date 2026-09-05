-- Phase 8 · body-weight tracking
--
-- One row per user per day: logging twice on the same day updates the entry
-- rather than stacking duplicates, because a day has one body weight worth
-- keeping. Trends are computed over weekly averages downstream — the spec is
-- explicit that single-day fluctuations must never be presented as progress.

create table if not exists public.body_weight_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,
  logged_on  date not null default current_date,
  weight_kg  numeric(5,2) not null check (weight_kg between 20 and 400),
  notes      text,
  created_at timestamptz not null default now(),
  unique (user_id, logged_on)
);

create index if not exists body_weight_logs_user_idx
  on public.body_weight_logs (user_id, logged_on desc);
