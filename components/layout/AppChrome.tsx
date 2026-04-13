"use client";

import {
  Anchor,
  AppShell,
  Box,
  Burger,
  Button,
  Divider,
  Drawer,
  Group,
  Stack,
  Text
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

type NavLinkDef = { href: string; label: string; match: (pathname: string) => boolean };

const mainLinks: NavLinkDef[] = [{ href: "/", label: "Nabídky", match: (p) => p === "/" }];

function NavItems({ pathname, links, onNavigate }: { pathname: string; links: NavLinkDef[]; onNavigate?: () => void }) {
  return (
    <>
      {links.map((link) => {
        const active = link.match(pathname);
        return (
          <Anchor
            key={link.href}
            component={Link}
            href={link.href}
            size="sm"
            fw={active ? 600 : 500}
            c={active ? "indigo.7" : "dimmed"}
            underline="never"
            onClick={onNavigate}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              backgroundColor: active ? "var(--mantine-color-indigo-light)" : undefined
            }}
          >
            {link.label}
          </Anchor>
        );
      })}
    </>
  );
}

export function AppChrome({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [mobileOpened, { toggle, close }] = useDisclosure(false);
  const [authReady, setAuthReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const navLinks = useMemo(() => mainLinks, []);

  const isAuth = pathname.startsWith("/auth");
  const isPublicLegal = pathname === "/privacy" || pathname === "/terms";
  const isHome = pathname === "/";

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSignedIn(Boolean(data.session));
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
      setAuthReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  async function logout() {
    await supabase.auth.signOut();
    close();
    router.push("/auth/login");
  }

  if (isAuth) {
    return (
      <Box mih="100vh" bg="gray.0">
        <Box maw={440} mx="auto" py="xl" px="md">
          {children}
        </Box>
      </Box>
    );
  }

  if (isPublicLegal) {
    return (
      <Box mih="100vh" bg="gray.0">
        <Box maw={800} mx="auto" py="xl" px="md">
          <Anchor component={Link} href="/" size="sm" c="dimmed" mb="lg" display="inline-block">
            ‹ Zpět na úvod
          </Anchor>
          {children}
        </Box>
      </Box>
    );
  }

  if (isHome && authReady && !signedIn) {
    return (
      <Box mih="100vh" bg="gray.0">
        <Box>{children}</Box>
      </Box>
    );
  }

  return (
    <AppShell
      mode="static"
      withBorder={false}
      header={{
        height: { base: 56, sm: 112 }
      }}
      padding="md"
      styles={{
        header: {
          paddingInline: 0,
          paddingBlock: 0,
          height: "auto",
          minHeight: 0
        },
        main: {
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0
        }
      }}
    >
      <AppShell.Header>
        <Stack
          gap={0}
          w="100%"
          style={{
            borderBottom: "1px solid var(--mantine-color-default-border)"
          }}
        >
          <Box px="md" py={10}>
            <Group justify="space-between" wrap="nowrap" align="center" gap="md">
              <Anchor component={Link} href="/" underline="never" c="inherit" style={{ minWidth: 0 }}>
                <Text ff="heading" fw={700} fz="lg" lh={1.3} component="span" lts="-0.02em">
                  Reality Portal
                </Text>
              </Anchor>
              <Group gap="xs" wrap="nowrap">
                <Burger opened={mobileOpened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Otevřít menu" />
                <Button size="compact-sm" variant="light" color="gray" onClick={() => void logout()}>
                  Odhlásit se
                </Button>
              </Group>
            </Group>
          </Box>

          <Box
            component="nav"
            aria-label="Hlavní navigace"
            px="md"
            py={8}
            visibleFrom="sm"
            style={{
              borderTop: "1px solid var(--mantine-color-default-border)"
            }}
          >
            <Group gap={4} wrap="wrap">
              <NavItems pathname={pathname} links={navLinks} />
            </Group>
          </Box>
        </Stack>
      </AppShell.Header>

      <Drawer
        opened={mobileOpened}
        onClose={close}
        position="right"
        size={280}
        title="Navigace"
        hiddenFrom="sm"
        zIndex={400}
        padding="md"
      >
        <Stack gap="lg" justify="space-between" style={{ minHeight: "60vh" }}>
          <Stack gap="xs">
            {navLinks.map((link) => {
              const active = link.match(pathname);
              return (
                <Anchor
                  key={link.href}
                  component={Link}
                  href={link.href}
                  size="md"
                  fw={active ? 600 : 500}
                  c={active ? "indigo.7" : "dark"}
                  underline="never"
                  onClick={close}
                  py="xs"
                  px="sm"
                  style={{
                    borderRadius: 8,
                    backgroundColor: active ? "var(--mantine-color-indigo-light)" : undefined
                  }}
                >
                  {link.label}
                </Anchor>
              );
            })}
          </Stack>
          <Divider />
          <Button variant="light" color="gray" fullWidth onClick={() => void logout()}>
            Odhlásit se
          </Button>
        </Stack>
      </Drawer>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
