-- Rozšíření klientů o preference pro nemovitosti (back office / Pepa use case).
alter table public.clients
  add column if not exists preferred_city text,
  add column if not exists preferred_district text,
  add column if not exists property_type_interest text,
  add column if not exists budget_min_czk numeric(14, 2),
  add column if not exists budget_max_czk numeric(14, 2),
  add column if not exists property_notes text;

comment on column public.clients.preferred_city is 'Preferované město poptávky.';
comment on column public.clients.preferred_district is 'Čtvrť / městská část (volitelné).';
comment on column public.clients.property_type_interest is 'Typ / dispozice (např. byt 2+kk, dům).';
comment on column public.clients.budget_min_czk is 'Spodní hranice rozpočtu v CZK.';
comment on column public.clients.budget_max_czk is 'Horní hranice rozpočtu v CZK.';
comment on column public.clients.property_notes is 'Poznámky k přáním ohledně nemovitosti.';

-- View Q1: stejné filtry jako v 008, navíc sloupce pro UI / analytiku.
-- DROP nutný: Postgres neumožní REPLACE při změně pořadí/sady sloupců oproti starému view.
drop view if exists public.vw_new_clients_q1;

create view public.vw_new_clients_q1 as
select
  c.id,
  c.full_name,
  c.email,
  c.phone,
  c.source_channel,
  c.preferred_city,
  c.preferred_district,
  c.property_type_interest,
  c.budget_min_czk,
  c.budget_max_czk,
  c.property_notes,
  c.created_at
from public.clients c
where extract(quarter from (c.created_at at time zone 'Europe/Prague')) = 1
  and extract(year from (c.created_at at time zone 'Europe/Prague'))
    = extract(year from (now() at time zone 'Europe/Prague'))
order by c.created_at desc;

-- Doplnění ukázkových dat pro známé seed UUID (idempotentní update).
update public.clients
set
  preferred_city = 'Praha',
  preferred_district = 'Holesovice',
  property_type_interest = 'byt 2+kk',
  budget_min_czk = 6500000,
  budget_max_czk = 9200000,
  property_notes = 'Hledá byt v klidnější lokalitě, možná lehká rekonstrukce.'
where id = '11111111-1111-1111-1111-111111111111';

update public.clients
set
  preferred_city = 'Praha',
  preferred_district = 'Karlín',
  property_type_interest = 'byt 3+1',
  budget_min_czk = 10000000,
  budget_max_czk = 14500000,
  property_notes = 'Světlý byt, minimálně 2. NP, balkón výhodou.'
where id = '22222222-2222-2222-2222-222222222222';

update public.clients
set
  preferred_city = 'Praha',
  preferred_district = null,
  property_type_interest = 'byt 1+kk',
  budget_min_czk = 5000000,
  budget_max_czk = 6500000,
  property_notes = 'Investice na pronájem, preferuje dokončený stav.'
where id = '33333333-3333-3333-3333-333333333333';

update public.clients
set
  preferred_city = 'Praha',
  preferred_district = 'Libeň',
  property_type_interest = 'byt 2+1',
  budget_min_czk = 7000000,
  budget_max_czk = 8500000,
  property_notes = 'Fixture klient pro test Q1 view.'
where id = '44444444-4444-4444-4444-444444444444';
