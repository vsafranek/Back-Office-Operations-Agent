-- Částka z inzerátu (Kč) pro filtr uložených nálezů; NULL = neznámá / starší záznam
alter table public.user_market_listing_finds
  add column if not exists price_czk bigint null;

comment on column public.user_market_listing_finds.price_czk is
  'Orientační cena z portálu v Kč; NULL u záznamů uložených před doplněním sloupce nebo bez ceny v API.';

create index if not exists user_market_listing_finds_user_price_idx
  on public.user_market_listing_finds (user_id, price_czk)
  where price_czk is not null;
