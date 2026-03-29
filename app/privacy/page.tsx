"use client";

import { Anchor, List, Stack, Text, Title } from "@mantine/core";
import Link from "next/link";

const APP_NAME = "Back Office Operations Agent";

function contactEmail(): string {
  return process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL?.trim() || "doplněte-kontakt@vaše-domena.cz";
}

export default function PrivacyPage() {
  const email = contactEmail();
  const effectiveDate = "28. 3. 2026";

  return (
    <Stack gap="lg" component="article">
      <header>
        <Title order={1} fz={{ base: "1.5rem", sm: "1.75rem" }} mb="xs">
          Zásady ochrany osobních údajů
        </Title>
        <Text size="sm" c="dimmed">
          {APP_NAME} · účinnost od {effectiveDate}
        </Text>
      </header>

      <section>
        <Title order={2} fz="lg" mb="sm">
          1. Správce údajů
        </Title>
        <Text size="sm" c="dimmed">
          Vyplňte identitu správce podle vaší právní subjektnosti (spolek, s.r.o., OSVČ apod.). Do
          produkční verze doplňte název, sídlo a IČO.
        </Text>
        <Text size="sm" mt="sm">
          <strong>Správce:</strong> [název právnické osoby / podnikající fyzické osoby]
          <br />
          <strong>Sídlo / adresa:</strong> [doplňte]
          <br />
          <strong>IČ:</strong> [doplňte] · <strong>Kontakt:</strong>{" "}
          <Anchor href={`mailto:${email}`} size="sm">
            {email}
          </Anchor>
        </Text>
      </section>

      <section>
        <Title order={2} fz="lg" mb="sm">
          2. Rozsah služby
        </Title>
        <Text size="sm">
          Služba {APP_NAME} je webová aplikace pro provozní činnost (agent, napojení na e-mail,
          kalendář a související úlohy). Aplikace může běžet na hostingu Vercel a využívat databázi a
          autentizaci poskytované službou Supabase.
        </Text>
      </section>

      <section>
        <Title order={2} fz="lg" mb="sm">
          3. Jaké údaje zpracováváme
        </Title>
        <List size="sm" spacing="xs">
          <List.Item>
            <strong>Účet a přihlášení:</strong> e-mailová adresa, identifikátor účtu, údaje
            poskytnuté poskytovatelem přihlášení (např. Google nebo Microsoft), pokud se tímto způsobem
            přihlásíte.
          </List.Item>
          <List.Item>
            <strong>Provozní a obsahová data:</strong> údaje, které do aplikace vložíte nebo které
            vzniknou jejím používáním (např. konverzace s agentem, nastavení integrací, soubory ve
            storage), v rozsahu, v jakém funkce aplikace umožňují.
          </List.Item>
          <List.Item>
            <strong>Technické údaje:</strong> základní provozní logy a údaje potřebné pro bezpečnost,
            dostupnost a řešení chyb (např. IP adresa v logách serveru v běžném rozsahu).
          </List.Item>
        </List>
      </section>

      <section>
        <Title order={2} fz="lg" mb="sm">
          4. Účel a právní základ
        </Title>
        <Text size="sm">
          Údaje zpracováváme za účelem poskytování služby, plnění smlouvy s uživatelem, oprávněných
          zájmů správce (bezpečnost provozu, zlepšování služby v přiměřeném rozsahu) a plnění
          zákonných povinností. Kde je to vyžadováno, můžeme vyžádat souhlas (např. u nepovinných
          marketingových sdělení — pokud takové funkce nabízíme).
        </Text>
      </section>

      <section>
        <Title order={2} fz="lg" mb="sm">
          5. Zpracovatelé a předání třetím stranám
        </Title>
        <Text size="sm" mb="xs">
          Službu nelze provozovat bez vybraných zpracovatelů. Mezi ně typicky patří:
        </Text>
        <List size="sm" spacing="xs">
          <List.Item>
            <strong>Supabase</strong> — autentizace, databáze a související infrastruktura dle jejich
            podmínek.
          </List.Item>
          <List.Item>
            <strong>Vercel</strong> (nebo jiný hostitel) — provoz webové aplikace.
          </List.Item>
          <List.Item>
            <strong>Google / Microsoft</strong> — pokud aktivujete přihlášení nebo integrace (např.
            Gmail, kalendář), zpracování probíhá i u těchto poskytovatelů podle jejich zásad.
          </List.Item>
        </List>
        <Text size="sm" mt="sm">
          Údaje můžeme předat i na základě zákona nebo oprávněné žádosti státních orgánů.
        </Text>
      </section>

      <section>
        <Title order={2} fz="lg" mb="sm">
          6. Doba uchování
        </Title>
        <Text size="sm">
          Údaje uchováváme po dobu existence účtu a nezbytně dlouho poté, aby bylo možné uplatnit
          práva, řešit spory a plnit zákonné povinnosti. Konkrétní lhůty mohou záviset na typech dat
          a nastavení aplikace; detaily lze upřesnit v interní dokumentaci správce.
        </Text>
      </section>

      <section>
        <Title order={2} fz="lg" mb="sm">
          7. Vaše práva
        </Title>
        <Text size="sm">
          V rozsahu stanoveném GDPR máte mimo jiné právo na přístup, opravu, výmaz, omezení
          zpracování, přenositelnost a vznést námitku. Máte právo podat stížnost u dozorového úřadu
          (v ČR Úřad pro ochranu osobních údajů). Práva uplatníte kontaktem na správce na e-mailu
          výše.
        </Text>
      </section>

      <section>
        <Title order={2} fz="lg" mb="sm">
          8. Změny
        </Title>
        <Text size="sm">
          Tyto zásady můžeme aktualizovat. Aktuální znění je vždy na této stránce; u podstatných změn
          vás můžeme informovat v aplikaci nebo e-mailem.
        </Text>
      </section>

      <footer>
        <Text size="xs" c="dimmed">
          <Anchor component={Link} href="/">
            Domů
          </Anchor>
          {" · "}
          <Anchor component={Link} href="/terms">
            Podmínky užívání
          </Anchor>
          {" · "}
          <Anchor component={Link} href="/auth/login">
            Přihlášení
          </Anchor>
        </Text>
      </footer>
    </Stack>
  );
}
