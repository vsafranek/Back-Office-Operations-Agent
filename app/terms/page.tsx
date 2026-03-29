"use client";

import { Anchor, List, Stack, Text, Title } from "@mantine/core";
import Link from "next/link";

const APP_NAME = "Back Office Operations Agent";

function contactEmail(): string {
  return process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL?.trim() || "doplněte-kontakt@vaše-domena.cz";
}

export default function TermsPage() {
  const email = contactEmail();
  const effectiveDate = "28. 3. 2026";

  return (
    <Stack gap="lg" component="article">
      <header>
        <Title order={1} fz={{ base: "1.5rem", sm: "1.75rem" }} mb="xs">
          Podmínky užívání služby
        </Title>
        <Text size="sm" c="dimmed">
          {APP_NAME} · účinnost od {effectiveDate}
        </Text>
      </header>

      <section>
        <Title order={2} fz="lg" mb="sm">
          1. Smluvní strany a předmět
        </Title>
        <Text size="sm" c="dimmed">
          Doplňte identitu provozovatele služby (název, sídlo, IČ). Text níže je šablona.
        </Text>
        <Text size="sm" mt="sm">
          Tyto podmínky upravují užívání webové služby {APP_NAME} (dále jen „služba“), kterou
          provozuje <strong>[název provozovatele]</strong>, sídlo <strong>[adresa]</strong>, IČ{" "}
          <strong>[IČ]</strong> (dále jen „provozovatel“). Kontakt:{" "}
          <Anchor href={`mailto:${email}`} size="sm">
            {email}
          </Anchor>
          .
        </Text>
      </section>

      <section>
        <Title order={2} fz="lg" mb="sm">
          2. Popis služby
        </Title>
        <Text size="sm">
          Služba umožňuje práci s provozním agentem, napojení na externí systémy (např. e-mail,
          kalendář) dle funkcí aplikace a nastavení uživatele. Rozsah funkcí se může měnit;
          provozovatel se snaží o rozumnou dostupnost služby, nezaručuje však nepřetržitý provoz
          bez výpadků.
        </Text>
      </section>

      <section>
        <Title order={2} fz="lg" mb="sm">
          3. Účet a přístup
        </Title>
        <Text size="sm" mb="xs">
          K části nebo celé službě může být vyžadována registrace nebo přihlášení (např. e-mailem a
          heslem nebo přes třetí stranu, jako je Google či Microsoft). Uživatel je povinen:
        </Text>
        <List size="sm" spacing="xs">
          <List.Item>uvádět pravdivé údaje v rozsahu nutném pro poskytování služby;</List.Item>
          <List.Item>chránit přístupové údaje a nenechat účet zneužít třetí osobou;</List.Item>
          <List.Item>
            neprodleně informovat provozovatele o podezření na neoprávněné použití účtu.
          </List.Item>
        </List>
      </section>

      <section>
        <Title order={2} fz="lg" mb="sm">
          4. Povolené a zakázané jednání
        </Title>
        <Text size="sm" mb="xs">
          Uživatel se zavazuje službu užívat v souladu s právním řádem a těmito podmínkami. Zejména
          je zakázáno:
        </Text>
        <List size="sm" spacing="xs">
          <List.Item>obcházet zabezpečení, zneužívat chyby nebo zátěžovat systém nad rozumnou míru;</List.Item>
          <List.Item>šířit škodlivý kód, spam nebo obsah porušující práva třetích osob;</List.Item>
          <List.Item>
            používat službu k činnosti, která by poškozovala provozovatele, ostatní uživatele nebo
            třetí strany.
          </List.Item>
        </List>
        <Text size="sm" mt="sm">
          Při porušení může provozovatel omezit nebo ukončit přístup k účtu a službě.
        </Text>
      </section>

      <section>
        <Title order={2} fz="lg" mb="sm">
          5. Obsah a data uživatele
        </Title>
        <Text size="sm">
          Uživatel odpovídá za obsah a údaje, které do služby vkládá nebo skrze ni zpracovává.
          Uživatel uděluje provozovateli licenci nezbytnou k provozu, zobrazení a zpracování těchto
          dat v rozsahu nutném pro poskytování služby, pokud zákon nestanoví jinak. Zpracování
          osobních údajů upravují{" "}
          <Anchor component={Link} href="/privacy" size="sm">
            zásady ochrany osobních údajů
          </Anchor>
          .
        </Text>
      </section>

      <section>
        <Title order={2} fz="lg" mb="sm">
          6. Duševní vlastnictví
        </Title>
        <Text size="sm">
          Software, design a ostatní prvky služby podléhají právu provozovatele nebo jeho
          licensórů. Uživateli není přenecháno vlastnické právo k softwaru; poskytuje se pouze
          oprávnění užívat službu v souladu s těmito podmínkami.
        </Text>
      </section>

      <section>
        <Title order={2} fz="lg" mb="sm">
          7. Odpovědnost
        </Title>
        <Text size="sm">
          Služba je poskytována v stavu „jak je“. Provozovatel neodpovídá za škodu vzniklou
          nemožností používat službu, nepřesnostmi výstupů automatizovaných funkcí (včetně AI) ani za
          jednání třetích stran (hosting, poskytovatelé přihlášení, API). Omezení se nevztahuje na
          povinnosti, které nelze právním řádem vyloučit (např. újma na zdraví způsobená úmyslně nebo
          z hrubé nedbalosti — dle platného práva).
        </Text>
      </section>

      <section>
        <Title order={2} fz="lg" mb="sm">
          8. Ukončení
        </Title>
        <Text size="sm">
          Uživatel může přestat službu užívat a může požádat o smazání účtu dle možností aplikace
          nebo kontaktem na provozovatele. Provozovatel může poskytování služby ukončit nebo omezit s
          přiměřeným oznámením, pokud to umožňuje povaha služby a zákon.
        </Text>
      </section>

      <section>
        <Title order={2} fz="lg" mb="sm">
          9. Změny podmínek
        </Title>
        <Text size="sm">
          Provozovatel může tyto podmínky měnit. Aktuální znění je zveřejněno na této stránce. O
          podstatných změnách může uživatele informovat v aplikaci nebo e-mailem. Pokračováním v
          užívání služby po účinnosti změn uživatel s rozumným předstihem vyjádří souhlas, pokud zákon
          nevyžaduje jiný postup.
        </Text>
      </section>

      <section>
        <Title order={2} fz="lg" mb="sm">
          10. Rozhodné právo
        </Title>
        <Text size="sm">
          Tyto podmínky se řídí právem České republiky. Příslušné jsou soudy České republiky, není-li
          pro spotřebitele zákonem stanoveno jinak.
        </Text>
      </section>

      <footer>
        <Text size="xs" c="dimmed">
          <Anchor component={Link} href="/">
            Domů
          </Anchor>
          {" · "}
          <Anchor component={Link} href="/privacy">
            Ochrana osobních údajů
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
