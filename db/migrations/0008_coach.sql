-- Phase 14/15 · coach conversations, messages, durable memory, summaries
--
-- One conversation per user for the MVP (created lazily); the schema still
-- carries conversation ids so multiple threads cost nothing later.
-- coach_memory holds durable facts as key/value ("prefers_machines: yes");
-- coach_summaries compress old chat so prompts never replay whole histories.

create table if not exists public.coach_conversations (
  id              uuid primary key default gen_random_uuid(),
  user_id         text not null,
  title           text,
  last_message_at timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists coach_conversations_user_idx
  on public.coach_conversations (user_id, last_message_at desc);

create table if not exists public.coach_messages (
  id              uuid primary key default gen_random_uuid(),
  user_id         text not null,
  conversation_id uuid not null
                    references public.coach_conversations (id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'system')),
  content         text not null,
  created_at      timestamptz not null default now()
);

create index if not exists coach_messages_conversation_idx
  on public.coach_messages (conversation_id, created_at);
create index if not exists coach_messages_user_idx
  on public.coach_messages (user_id);

create table if not exists public.coach_memory (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,
  key        text not null,
  value      text not null,
  source     text not null default 'chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

create trigger coach_memory_set_updated_at
  before update on public.coach_memory
  for each row execute function public.set_updated_at();

create table if not exists public.coach_summaries (
  id               uuid primary key default gen_random_uuid(),
  user_id          text not null,
  conversation_id  uuid not null
                     references public.coach_conversations (id) on delete cascade,
  up_to_message_id uuid,
  summary          text not null,
  created_at       timestamptz not null default now()
);

create index if not exists coach_summaries_conversation_idx
  on public.coach_summaries (conversation_id, created_at desc);
