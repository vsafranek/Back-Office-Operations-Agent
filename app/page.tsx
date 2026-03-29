"use client";

import {
  Badge,
  Box,
  Button,
  Card,
  Code,
  Container,
  Divider,
  Group,
  List,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title
} from "@mantine/core";
import {
  IconArrowRight,
  IconBrandAzure,
  IconBrandGoogle,
  IconCalendarClock,
  IconChartInfographic,
  IconChevronRight,
  IconFolderOpen,
  IconLayoutDashboard,
  IconMessageChatbot,
  IconPlugConnected,
  IconSettings,
  IconTerminal2
} from "@tabler/icons-react";
import Link from "next/link";

const featureCards = [
  {
    icon: IconMessageChatbot,
    gradient: { from: "indigo.5", to: "violet.6", deg: 125 },
    title: "Agent a konverzace",
    body:
      "Dotazy česky, více profilů agenta, streamované odpovědi a konverzace. Panely pro trace, audit, data a nástroje u posledního běhu."
  },
  {
    icon: IconPlugConnected,
    gradient: { from: "teal.6", to: "cyan.5", deg: 118 },
    title: "Google a Microsoft 365",
    body:
      "Přihlášení přes Google nebo Microsoft; kalendář a pošta se napojí z přihlášení nebo z Nastavení. Gmail, Outlook a plánování v jednom toku."
  },
  {
    icon: IconCalendarClock,
    gradient: { from: "violet.5", to: "grape.7", deg: 132 },
    title: "Naplánované úlohy",
    body:
      "Opakované spouštění agenta (cron), vlastní systémové zadání a výběr profilu. Potvrzení z chatu; napojení na Supabase dle návodu v Nastavení."
  },
  {
    icon: IconChartInfographic,
    gradient: { from: "orange.5", to: "pink.6", deg: 108 },
    title: "Reporty a úložiště",
    body:
      "Artefakty PPTX, PDF, Excel a grafy do Storage. Prohlížeč souborů s náhledy a stahováním — jako knihovna dokumentů."
  }
] as const;

const quickLinks = [
  {
    href: "/dashboard",
    label: "Dashboard",
    description: "Chat, konverzace a panely agenta",
    icon: IconLayoutDashboard,
    color: "indigo"
  },
  {
    href: "/settings",
    label: "Nastavení",
    description: "Integrace, účet, naplánované úlohy",
    icon: IconSettings,
    color: "gray"
  },
  {
    href: "/storage",
    label: "Storage",
    description: "Soubory a artefakty z agenta",
    icon: IconFolderOpen,
    color: "violet"
  }
] as const;

export default function HomePage() {
  return (
    <Box component="main" style={{ overflowX: "hidden" }}>
      <Container size="lg" py={{ base: "md", sm: "xl" }} pb={56}>
        <Stack gap={56}>
          {/* Hero */}
          <Box
            pos="relative"
            style={{
              borderRadius: "var(--mantine-radius-xl)",
              padding: "clamp(1.75rem, 5vw, 3rem)",
              border: "1px solid color-mix(in srgb, var(--mantine-color-indigo-3) 55%, transparent)",
              background:
                "linear-gradient(145deg, var(--mantine-color-indigo-0) 0%, var(--mantine-color-violet-0) 42%, var(--mantine-color-blue-0) 100%)",
              boxShadow: "0 24px 48px -28px color-mix(in srgb, var(--mantine-color-indigo-5) 35%, transparent)"
            }}
          >
            <Box
              aria-hidden
              pos="absolute"
              top={-40}
              right={-30}
              w={220}
              h={220}
              style={{
                borderRadius: "50%",
                background: "radial-gradient(circle, color-mix(in srgb, var(--mantine-color-violet-3) 25%, transparent) 0%, transparent 70%)",
                pointerEvents: "none"
              }}
            />
            <Box
              aria-hidden
              pos="absolute"
              bottom={-50}
              left={-40}
              w={280}
              h={280}
              style={{
                borderRadius: "50%",
                background: "radial-gradient(circle, color-mix(in srgb, var(--mantine-color-indigo-3) 22%, transparent) 0%, transparent 72%)",
                pointerEvents: "none"
              }}
            />

            <Stack gap="lg" maw={760} style={{ position: "relative" }}>
              <Group gap="xs" wrap="wrap">
                <Badge variant="light" color="indigo" size="lg" radius="md" tt="none" fw={600}>
                  Realitní provoz
                </Badge>
                <Badge variant="outline" color="gray" size="lg" radius="md" tt="none">
                  AI asistent
                </Badge>
              </Group>

              <Title
                order={1}
                fz={{ base: "clamp(1.85rem, 5vw, 2.75rem)" }}
                lh={1.12}
                lts="-0.04em"
                ff="heading"
                fw={800}
              >
                Back Office
                <Text span inherit c="indigo.7" display="block">
                  Operations Agent
                </Text>
              </Title>

              <Text size="lg" c="dark.6" lh={1.65} maw={620}>
                Jedno místo pro konverzaci s agentem, analytiku, napojení na kalendář a poštu a opakované úlohy — postavené pro
                back-office realitního týmu.
              </Text>

              <List
                spacing="xs"
                size="sm"
                c="dimmed"
                icon={
                  <ThemeIcon color="indigo" variant="light" size={22} radius="xl">
                    <IconChevronRight size={14} stroke={2} />
                  </ThemeIcon>
                }
                styles={{ item: { alignItems: "center" } }}
              >
                <List.Item>Streamované odpovědi, historie konverzací a doplňkové panely</List.Item>
                <List.Item>Integrace Google a Microsoft (přihlášení i Nastavení)</List.Item>
                <List.Item>Úložiště artefaktů s prohlížečem souborů</List.Item>
              </List>

              <Group gap="sm" wrap="wrap" pt="xs">
                <Button
                  component={Link}
                  href="/auth/login"
                  size="md"
                  radius="xl"
                  rightSection={<IconArrowRight size={18} stroke={1.75} />}
                >
                  Přihlásit se
                </Button>
                <Button component={Link} href="/auth/register" variant="light" color="indigo" size="md" radius="xl">
                  Vytvořit účet
                </Button>
                <Button component={Link} href="/dashboard" variant="default" size="md" radius="xl">
                  Dashboard
                </Button>
              </Group>

              <Group gap="md" wrap="wrap" c="dimmed">
                <Group gap={6} wrap="nowrap">
                  <IconBrandGoogle size={18} stroke={1.5} />
                  <Text size="xs">Google</Text>
                </Group>
                <Group gap={6} wrap="nowrap">
                  <IconBrandAzure size={18} stroke={1.5} />
                  <Text size="xs">Microsoft 365</Text>
                </Group>
                <Text size="xs" visibleFrom="sm">
                  · Přihlášení i napojení služeb
                </Text>
              </Group>
            </Stack>
          </Box>

          {/* Quick links */}
          <section>
            <Title order={2} fz={{ base: 20, sm: 22 }} mb="md" ff="heading" fw={700}>
              Rychlé odkazy
            </Title>
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
              {quickLinks.map((item) => (
                <Card
                  key={item.href}
                  component={Link}
                  href={item.href}
                  padding="lg"
                  radius="lg"
                  withBorder
                  shadow="xs"
                  style={{
                    textDecoration: "none",
                    color: "inherit",
                    transition: "transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease"
                  }}
                  styles={{
                    root: {
                      "&:hover": {
                        transform: "translateY(-3px)",
                        boxShadow: "var(--mantine-shadow-md)",
                        borderColor: "var(--mantine-color-indigo-3)"
                      }
                    }
                  }}
                >
                  <Group justify="space-between" wrap="nowrap" align="flex-start" mb="sm">
                    <ThemeIcon size={46} radius="lg" variant="light" color={item.color}>
                      <item.icon size={26} stroke={1.5} />
                    </ThemeIcon>
                    <IconArrowRight size={20} stroke={1.5} style={{ opacity: 0.35, flexShrink: 0 }} />
                  </Group>
                  <Text fw={700} size="sm" mb={6}>
                    {item.label}
                  </Text>
                  <Text size="xs" c="dimmed" lh={1.5}>
                    {item.description}
                  </Text>
                </Card>
              ))}
            </SimpleGrid>
          </section>

          {/* Features */}
          <section>
            <Divider
              label={
                <Text size="sm" fw={600} c="dimmed" tt="uppercase" lts="0.08em">
                  Funkce
                </Text>
              }
              labelPosition="center"
              mb="xl"
            />
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
              {featureCards.map((card) => (
                <Card
                  key={card.title}
                  padding="xl"
                  radius="lg"
                  withBorder
                  shadow="sm"
                  style={{
                    background: "linear-gradient(180deg, var(--mantine-color-body) 0%, color-mix(in srgb, var(--mantine-color-gray-0) 80%, var(--mantine-color-body)) 100%)"
                  }}
                >
                  <ThemeIcon size={48} radius="md" variant="gradient" gradient={card.gradient} mb="lg">
                    <card.icon size={26} stroke={1.5} color="white" />
                  </ThemeIcon>
                  <Title order={3} fz={18} mb="sm" ff="heading" fw={700}>
                    {card.title}
                  </Title>
                  <Text size="sm" c="dimmed" lh={1.65}>
                    {card.body}
                  </Text>
                </Card>
              ))}
            </SimpleGrid>
          </section>

          {/* Developers */}
          <Card
            padding="xl"
            radius="lg"
            withBorder
            style={{
              background: "linear-gradient(135deg, var(--mantine-color-dark-7) 0%, var(--mantine-color-dark-6) 100%)",
              borderColor: "var(--mantine-color-dark-4)"
            }}
          >
            <Group justify="space-between" align="flex-start" wrap="wrap" gap="md" mb="md">
              <Group gap="sm" wrap="nowrap">
                <ThemeIcon size={44} radius="md" variant="light" color="gray" bg="dark.5" c="indigo.3">
                  <IconTerminal2 size={24} stroke={1.5} />
                </ThemeIcon>
                <div>
                  <Title order={3} c="gray.0" fz={18} ff="heading" fw={700}>
                    Pro vývojáře
                  </Title>
                  <Text size="sm" c="dark.1" mt={4}>
                    HTTP rozhraní se stejnou autorizací jako ve webové aplikaci
                  </Text>
                </div>
              </Group>
            </Group>
            <Code
              block
              c="indigo.1"
              bg="dark.8"
              style={{
                borderRadius: "var(--mantine-radius-md)",
                border: "1px solid var(--mantine-color-dark-4)",
                fontSize: "0.875rem"
              }}
            >
              POST /api/agent
            </Code>
            <Text size="xs" c="dark.2" mt="md" lh={1.6}>
              Streamovaný chat: <Code color="dark">/api/agent/stream</Code> — Bearer token jako u zbytku aplikace.
            </Text>
          </Card>
        </Stack>
      </Container>
    </Box>
  );
}
