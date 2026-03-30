-- Vyhledatelný kontext lokace: normCs(title || ' ' || location) z aplikace + zpětné doplnění (aproximace bez NFD)
alter table public.user_market_listing_finds
  add column if not exists location_context text null;

comment on column public.user_market_listing_finds.location_context is
  'Sloučený z titulku a lokality (diakritika zrušena, malá pisma) pro kontextové hledání; NULL jen u starých řádků před migrací.';

update public.user_market_listing_finds
set location_context = lower(
  translate(
    coalesce(title, '') || ' ' || coalesce(location, ''),
    'áàäâãåčďéěíĺľňóöőôřšťúůüýžÁÀÄÂÃÅČĎÉĚÍĹĽŇÓÖŐÔŘŠŤÚŮÜÝŽ',
    'aaaaaaccdeeeeillnooooorstuuuuuzAAAAAACCdeEEEILLNOOOOORSTUUUUUZ'
  )
)
where location_context is null;

create extension if not exists pg_trgm;

create index if not exists user_market_listing_finds_location_context_trgm
  on public.user_market_listing_finds
  using gin (location_context gin_trgm_ops)
  where location_context is not null;
