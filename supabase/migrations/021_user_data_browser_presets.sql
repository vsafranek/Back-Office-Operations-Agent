-- Uložené “záložky” datového prohlížeče: jen allowlistovaný base_dataset + strukturované filtry (žádné volné SQL).
create table if not exists public.user_data_browser_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  base_dataset text not null,
  row_text_narrowing text,
  client_filters jsonb,
  filter_label text,
  suggest_source_channel_chart boolean not null default false,
  suggest_derived_charts boolean not null default false,
  derived_chart_kind_hint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_data_browser_presets_name_len check (char_length(trim(name)) between 1 and 120),
  constraint user_data_browser_presets_dataset_chk check (
    base_dataset in (
      'new_clients_q1',
      'leads_vs_sales_6m',
      'deal_sales_detail',
      'clients',
      'missing_reconstruction'
    )
  ),
  constraint user_data_browser_presets_chart_hint_chk check (
    derived_chart_kind_hint is null or derived_chart_kind_hint in ('bar', 'line', 'pie')
  )
);

create index if not exists user_data_browser_presets_user_id_idx
  on public.user_data_browser_presets (user_id);

create index if not exists user_data_browser_presets_user_created_idx
  on public.user_data_browser_presets (user_id, created_at desc);

alter table public.user_data_browser_presets enable row level security;

drop policy if exists "users_manage_own_data_browser_presets" on public.user_data_browser_presets;

create policy "users_manage_own_data_browser_presets"
on public.user_data_browser_presets
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
