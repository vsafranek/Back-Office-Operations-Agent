# Model uzavřených obchodů (`deals`)

## Kdo koupil, co a kdy (aktuální schéma)

- **Nemovitost:** `property_id` → `properties`.
- **Primární kupec v CRM:** `client_id` → `clients` (kontaktní jméno, e‑mail, telefon v tabulce klientů).
- **Čas a cena:** `sold_at`, `sold_price`; **podpis smlouvy** (volitelně): `contract_signed_at`.
- **Audit / právní osoba:** `buyer_legal_name`, `buyer_snapshot` (JSON — např. text z katastru, IČO); slouží jako historická stopa, když se údaj v `clients` později změní.
- **Interní reference:** `internal_deal_ref`, `listing_ref`, `deal_source`, `transfer_notes`.
- **Stav:** `status` (`closed` / `cancelled` / …); zrušené obchody se nepočítají do agregací prodeje.

## Spolukupci a více stran

Dnes platí **jeden primární kupec na řádek `deals`** přes `client_id`. Spolukupci, více smluvních stran nebo buyer ≠ kontakt v CRM mají být řešeny **budoucí tabulkou** (např. `deal_parties` s rolí), nikoli duplicitou řádků `deals` na stejnou nemovitost.

## Reporty

- Měsíční souhrn leadů vs. **prodaných bytů:** view `vw_leads_vs_sales_6m` (počítají se obchody s `property_kind` byt nebo bez `property_id`, bez `cancelled`).
- **Detail řádků** (kdo koupil co): view `vw_deal_sales_detail` (JOIN `deals`, `clients`, `properties`).
