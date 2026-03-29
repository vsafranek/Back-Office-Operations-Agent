"use client";

import { Button, Card, Container, Group, SimpleGrid, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import Link from "next/link";

export default function HomePage() {
  return (
    <Container size="lg" py={{ base: "lg", md: "xl" }} pb={48}>
      <Stack gap={48}>
        <Stack gap="lg" maw={720}>
          <Title order={1} fz={{ base: 32, sm: 40 }} lh={1.15} lts="-0.03em">
            Back Office Operations Agent
          </Title>
          <Text size="lg" c="dimmed">
            Operativní asistent pro realitní provoz: konverzace s agentem, analytika, napojení na kalendář a poštu a
            naplánované úlohy — na jednom místě.
          </Text>
          <Text size="sm" c="dimmed">
            Odkazy na aplikaci (Dashboard, Nastavení, Storage) jsou v horní liště.
          </Text>
          <Group gap="sm" wrap="wrap">
            <Button component={Link} href="/auth/login" size="md">
              Přihlásit se
            </Button>
            <Button component={Link} href="/auth/register" variant="light" size="md">
              Registrace
            </Button>
          </Group>
        </Stack>

        <div>
          <Title order={2} mb="lg" fz={22}>
            Co aplikace umí
          </Title>
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
            <Card withBorder padding="lg" shadow="sm">
              <ThemeIcon
                size={44}
                radius="xl"
                variant="gradient"
                gradient={{ from: "indigo.5", to: "violet.5", deg: 120 }}
                mb="md"
              >
                <Text fw={700} size="sm" c="white">
                  AI
                </Text>
              </ThemeIcon>
              <Title order={4} mb="xs">
                Agent a konverzace
              </Title>
              <Text size="sm" c="dimmed">
                Dotazy v přirozeném jazyce, více profilů agenta, streamované odpovědi a historie podle konverzací.
                Doprovodné panely pro trace a audit posledního běhu.
              </Text>
            </Card>
            <Card withBorder padding="lg" shadow="sm">
              <ThemeIcon
                size={44}
                radius="xl"
                variant="gradient"
                gradient={{ from: "teal.5", to: "cyan.5", deg: 115 }}
                mb="md"
              >
                <Text fw={700} size="sm" c="white">
                  ∫
                </Text>
              </ThemeIcon>
              <Title order={4} mb="xs">
                Integrace Google a Microsoft 365
              </Title>
              <Text size="sm" c="dimmed">
                Kalendář a e-mail (Gmail / Outlook) přes OAuth v Nastavení — stejný model jako u automatizačních nástrojů,
                odděleně od přihlášení do aplikace.
              </Text>
            </Card>
            <Card withBorder padding="lg" shadow="sm">
              <ThemeIcon
                size={44}
                radius="xl"
                variant="gradient"
                gradient={{ from: "violet.5", to: "grape.6", deg: 130 }}
                mb="md"
              >
                <Text fw={700} size="xs" c="white">
                  Cron
                </Text>
              </ThemeIcon>
              <Title order={4} mb="xs">
                Naplánované úlohy
              </Title>
              <Text size="sm" c="dimmed">
                Cron úlohy s vlastním systémovým zadáním a volbou agenta; potvrzení můžete provést přímo z chatu.
                Napojení na Supabase pg_cron podle návodu v Nastavení.
              </Text>
            </Card>
            <Card withBorder padding="lg" shadow="sm">
              <ThemeIcon
                size={44}
                radius="xl"
                variant="gradient"
                gradient={{ from: "orange.5", to: "pink.5", deg: 110 }}
                mb="md"
              >
                <Text fw={700} size="xs" c="white">
                  St
                </Text>
              </ThemeIcon>
              <Title order={4} mb="xs">
                Reporty a storage
              </Title>
              <Text size="sm" c="dimmed">
                Artefakty (PPTX, PDF, Excel, grafy) do úložiště a prohlížeč souborů v sekci Storage na dashboardu.
              </Text>
            </Card>
          </SimpleGrid>
        </div>

        <Card withBorder padding="lg" bg="gray.0">
          <Title order={3} mb="sm" fz={18}>
            Pro vývojáře
          </Title>
          <Text size="sm" c="dimmed" mb="md">
            HTTP endpoint pro integrace a vlastní klienty:
          </Text>
          <Text
            component="code"
            display="block"
            p="sm"
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: "0.875rem",
              borderRadius: 8,
              background: "var(--mantine-color-body)"
            }}
          >
            POST /api/agent
          </Text>
          <Text size="xs" c="dimmed" mt="md">
            Streamovaný chat používá <code style={{ fontSize: "inherit" }}>/api/agent/stream</code> s autorizací
            stejnou jako ve webové aplikaci.
          </Text>
        </Card>
      </Stack>
    </Container>
  );
}
