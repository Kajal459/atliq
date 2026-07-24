import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AtliQ Sales Memory Assistant",
  description: "Internal prototype - AI middle layer over AtliQ's sales channels and CRM.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
