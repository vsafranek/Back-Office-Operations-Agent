import type { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Back Office Operations Agent",
  description: "Agent for real estate operations, analytics and workflows."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="cs">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", padding: 24 }}>
        {children}
      </body>
    </html>
  );
}
