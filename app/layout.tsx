import { ColorSchemeScript } from "@mantine/core";
import type { Metadata } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import React from "react";

import { AppChrome } from "@/components/layout/AppChrome";

import { Providers } from "./providers";

const fontSans = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "swap"
});

const fontDisplay = Outfit({
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  display: "swap"
});

export const metadata: Metadata = {
  title: "Back Office Operations Agent",
  description: "Agent for real estate operations, analytics and workflows."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="cs" suppressHydrationWarning>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body
        className={`${fontSans.variable} ${fontDisplay.variable}`}
        style={{ margin: 0 }}
        suppressHydrationWarning
      >
        <Providers>
          <AppChrome>{children}</AppChrome>
        </Providers>
      </body>
    </html>
  );
}
