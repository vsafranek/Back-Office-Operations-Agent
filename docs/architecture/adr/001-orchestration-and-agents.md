# ADR 001 – Orchestrace a profily agentů

## Stav: přijato

## Kontext

Potřebujeme několik chování orchestrace (rychlá klasifikace vs. explicitní úvaha) a konfiguraci držet mimo kód business logiky.

## Rozhodnutí

- Definice agentů žijí v **`lib/agent/config/agents/*.agent.config.ts`** a registrují se v **`registry.ts`**.
- Režim **`basic`** volá kompaktní LLM klasifikátor (`intent-classifier`).
- Režim **`thinking`** volá rozšířený krok s úvahou a JSON výstupem (`thinking-orchestrator`).
- Výchozí orchestrátor produktu je **`thinking-orchestrator`** (viz registry).
- Subagenti zůstávají specializované moduly volané z **`runAgentOrchestrator`** podle `intent`.

## Důsledky

- Přidání agenta = nový config soubor + zápis do registru.
- Thinking režim zvyšuje počet tokenů a latenci oproti basic; vhodné pro složitější dotazy.
