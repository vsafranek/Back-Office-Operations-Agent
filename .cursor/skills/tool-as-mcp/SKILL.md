---
name: tool-as-mcp
description: Definuje postup, jak před voláním každého toolu agent nejdřív ověří jeho rozhraní (schema/descriptor), zkontroluje vstupy a validuje výstup. Use when user asks how to use a specific tool, how tools are structured, or requests a tool to be handled as MCP (schema-driven).
---

# Tool jako MCP

## Kdy skill použít
- Use when user asks, aby agent vysvětlil „jak zavolat tool“ nebo jak funguje konkrétní tool.
- Use when user požaduje postup typu „treat each tool like MCP“ (schema-driven).
- Use when user žádá, aby agent nejdřív ověřil podporované vstupy/výstupy před samotným voláním.

## Povinné chování před voláním toolu
Před každým použitím toolu agent musí:
1. Identifikovat tool name a účel callu (co tím řeší).
2. Zjistit rozhraní toolu jako MCP:
   - jaká vstupní pole jsou podporovaná,
   - které parametry jsou povinné/volitelné,
   - typy (string/number/boolean/objects/arrays),
   - omezení (max/min, allowed values, formát cesty, atd.).
3. Vstupy validovat:
   - mapovat uživatelský záměr do přesných polí schema,
   - odstranit/ignorovat nepodporované parametry,
   - zajistit bezpečné hodnoty (např. escapování, normalizace path).
4. Teprve potom tool zavolat.
5. Po volání zpracovat výstup podle očekávaného output tvaru:
   - zkontrolovat, že fields existují,
   - pokud chybí nebo je tvar jiný, agent musí reagovat (retry s korektními parametry / fallback / vysvětlit, co je špatně).

## Chování při chybě
- Pokud tool vrátí chybu, agent musí:
  1. převést chybu do čitelné příčiny pro uživatele (např. „chybí povinný parametr“, „neplatná hodnota“, „auth je potřeba“),
  2. navrhnout nejpravděpodobnější opravu (co změnit v inputu) a až poté zkoušet znovu.

## Šablona pro definici budoucích toolů (při tvorbě nových)
Každý další tool musí být v dokumentaci specifikován minimálně takto:
- `name`: jednoznačný název toolu
- `description`: co tool dělá a kdy se používá (trigger terms)
- `inputSchema`: seznam vstupů (povinné/volitelné), typy a omezení
- `outputSchema`: očekávané výstupní pole/typy
- `auth`: vyžaduje auth? jaký typ (user token / service role / žádné)
- `sideEffects`: má tool vedlejší efekty? je to idempotentní?
- `errorModel`: typické chyby a jejich interpretace
- `examples`: 1–2 ukázkové inputy a očekávané output key struktury

## Kontrolní seznam (internal)
- [ ] Tool call používá pouze parametry z inputSchema
- [ ] Vstupy sedí na typy a omezení
- [ ] Output je validovaný podle outputSchema
- [ ] Chyby jsou mapped na příčinu a doporučení opravy

