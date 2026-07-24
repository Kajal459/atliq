import type { Metadata } from "next";
import { Lora, Inter } from "next/font/google";
import "./globals.css";

// Serif for headlines (Lora, with italic support), clean sans for everything
// else (Inter) - matches the reference styling requested: elegant serif
// headline text over a warm cream/forest-green palette.
const lora = Lora({
  subsets: ["latin"],
  variable: "--font-voice",
  style: ["normal", "italic"],
  weight: ["500", "600", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "AtliQ Sales Memory Assistant",
  description: "Internal prototype - AI middle layer over AtliQ's sales channels and CRM.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${lora.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-cream font-sans text-ink">{children}</body>
    </html>
  );
}
