import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CareerHub — Hiring, in good company",
  description: "Find thoughtful work and meet the teams behind it.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}