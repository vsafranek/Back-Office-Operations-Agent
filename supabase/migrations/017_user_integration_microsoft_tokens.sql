alter table public.user_integration_settings
  add column if not exists microsoft_access_token text,
  add column if not exists microsoft_refresh_token text;
