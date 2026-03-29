-- Filtry podle sloupců v UI datového prohlížeče (podřetězec v buňce; aplikace na klientovi).
alter table public.user_data_browser_presets
  add column if not exists column_filters jsonb;
