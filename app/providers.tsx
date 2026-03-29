"use client";

import { MantineProvider, createTheme } from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";

import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";

const theme = createTheme({
  primaryColor: "indigo",
  primaryShade: { light: 6, dark: 7 },
  defaultRadius: "lg",
  cursorType: "pointer",
  respectReducedMotion: true,
  defaultGradient: { from: "indigo.5", to: "violet.5", deg: 120 },
  fontFamily: 'var(--font-sans), ui-sans-serif, system-ui, sans-serif',
  fontFamilyMonospace:
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace",
  headings: {
    fontFamily: 'var(--font-display), var(--font-sans), system-ui, sans-serif',
    fontWeight: "700",
    textWrap: "balance"
  },
  components: {
    Button: {
      defaultProps: { radius: "xl" }
    },
    ActionIcon: {
      defaultProps: { radius: "lg" }
    },
    TextInput: {
      defaultProps: { radius: "md" }
    },
    PasswordInput: {
      defaultProps: { radius: "md" }
    },
    Paper: {
      defaultProps: { radius: "lg" }
    },
    Card: {
      defaultProps: { radius: "lg" }
    },
    Modal: {
      defaultProps: { radius: "lg" }
    },
    Drawer: {
      defaultProps: { radius: "lg" }
    }
  }
});

export function Providers({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <ModalsProvider>
        <Notifications position="top-right" zIndex={4000} />
        {children}
      </ModalsProvider>
    </MantineProvider>
  );
}
