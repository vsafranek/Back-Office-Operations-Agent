import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ochrana osobních údajů | Back Office",
  description:
    "Zásady ochrany osobních údajů aplikace Back Office — provoz, přihlášení a zpracovatelé."
};

export default function PrivacyLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
