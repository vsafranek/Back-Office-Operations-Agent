-- Rozšíření allowlistu base_dataset o lead_pipeline_summary (user_data_browser_presets).
alter table public.user_data_browser_presets
  drop constraint if exists user_data_browser_presets_dataset_chk;

alter table public.user_data_browser_presets
  add constraint user_data_browser_presets_dataset_chk check (
    base_dataset in (
      'new_clients_q1',
      'leads_vs_sales_6m',
      'lead_pipeline_summary',
      'deal_sales_detail',
      'clients',
      'missing_reconstruction'
    )
  );
