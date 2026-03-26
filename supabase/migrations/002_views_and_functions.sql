create or replace view public.vw_new_clients_q1 as
select
  c.id,
  c.full_name,
  c.email,
  c.source_channel,
  c.created_at
from public.clients c
where extract(quarter from c.created_at) = 1
order by c.created_at desc;

create or replace view public.vw_leads_vs_sales_6m as
with months as (
  select
    date_trunc('month', now()) - (interval '1 month' * g.i) as month_start
  from generate_series(0, 5) as g(i)
)
select
  m.month_start::date as month,
  coalesce(l.leads_count, 0) as leads_count,
  coalesce(d.sold_count, 0) as sold_count
from months m
left join (
  select date_trunc('month', created_at) as mth, count(*) as leads_count
  from public.leads
  group by 1
) l on l.mth = m.month_start
left join (
  select date_trunc('month', sold_at) as mth, count(*) as sold_count
  from public.deals
  where sold_at is not null
  group by 1
) d on d.mth = m.month_start
order by m.month_start asc;

create or replace function public.fn_missing_reconstruction_data()
returns table (
  property_id uuid,
  title text,
  city text,
  missing_reconstruction boolean,
  missing_structural_changes boolean
)
language sql
stable
as $$
  select
    p.id as property_id,
    p.title,
    p.city,
    (p.reconstruction_notes is null or btrim(p.reconstruction_notes) = '') as missing_reconstruction,
    (p.structural_changes is null or btrim(p.structural_changes) = '') as missing_structural_changes
  from public.properties p
  where (p.reconstruction_notes is null or btrim(p.reconstruction_notes) = '')
     or (p.structural_changes is null or btrim(p.structural_changes) = '');
$$;
