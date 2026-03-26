create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Nova konverzace',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.conversations enable row level security;
alter table public.conversation_messages enable row level security;

drop policy if exists "users_manage_own_conversations" on public.conversations;
create policy "users_manage_own_conversations"
on public.conversations
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "users_manage_own_conversation_messages" on public.conversation_messages;
create policy "users_manage_own_conversation_messages"
on public.conversation_messages
for all
to authenticated
using (
  exists (
    select 1
    from public.conversations c
    where c.id = conversation_messages.conversation_id
      and c.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.conversations c
    where c.id = conversation_messages.conversation_id
      and c.user_id = auth.uid()
  )
);
