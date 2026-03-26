create table if not exists public.user_integration_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  calendar_provider text not null default 'google',
  calendar_account_email text,
  calendar_id text,
  mail_provider text not null default 'gmail',
  mail_from_email text,
  google_refresh_token text,
  google_access_token text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.user_integration_settings enable row level security;

drop policy if exists "users_manage_own_integration_settings" on public.user_integration_settings;
create policy "users_manage_own_integration_settings"
on public.user_integration_settings
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
