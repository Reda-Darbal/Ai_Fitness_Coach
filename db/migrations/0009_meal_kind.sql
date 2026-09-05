-- Nutrition feature: meal-photo analyses join the AI audit log.
alter table public.ai_generations
  drop constraint if exists ai_generations_kind_check;
alter table public.ai_generations
  add constraint ai_generations_kind_check
  check (kind in ('program', 'checkin', 'photo_review', 'chat', 'meal'));
