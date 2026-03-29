-- Uživatelské volby UI (agent, prezentace, …).
create table if not exists public.user_ui_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  presentation_opening_slide boolean not null default true,
  updated_at timestamptz not null default now()
);

comment on table public.user_ui_preferences is 'Uložené preference uživatele v aplikaci (odděleně od integrací).';
comment on column public.user_ui_preferences.presentation_opening_slide is 'Zda generovat PPTX/PDF s titulním úvodním slidem.';

alter table public.user_ui_preferences enable row level security;

drop policy if exists "users_manage_own_ui_preferences" on public.user_ui_preferences;
create policy "users_manage_own_ui_preferences"
on public.user_ui_preferences
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
