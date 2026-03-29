import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Podmínky užívání | Back Office",
  description: "Obchodní podmínky a pravidla užívání aplikace Back Office Operations Agent."
};

export default function TermsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
