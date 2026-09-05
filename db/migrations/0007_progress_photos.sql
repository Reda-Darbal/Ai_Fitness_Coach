-- Phase 11 · progress photos
--
-- The table stores OBJECT KEYS, never URLs: the bucket is private and every
-- view goes through a short-lived presigned URL minted server-side for the
-- owner. Keys are namespaced progress/{user_id}/… and every action verifies
-- that prefix against the caller before touching storage.

create table if not exists public.progress_photos (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,
  taken_on   date not null default current_date,
  pose       text not null check (pose in ('front', 'side', 'back')),
  object_key text not null unique,
  weight_kg  numeric(5,2) check (weight_kg between 20 and 400),
  notes      text,
  created_at timestamptz not null default now()
);

create index if not exists progress_photos_user_idx
  on public.progress_photos (user_id, taken_on desc, pose);
