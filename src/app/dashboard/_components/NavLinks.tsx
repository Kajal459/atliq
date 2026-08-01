"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/dashboard/digest", label: "Weekly Digest" },
  { href: "/dashboard/approvals", label: "Approval Inbox" },
  { href: "/dashboard/deals", label: "Deal Timeline" },
  { href: "/dashboard/settings", label: "Settings" },
];

// No separate "Home" link - the atliq wordmark itself links there (see
// layout.tsx). The current page underlines itself so it's obvious at a
// glance which of the three sections you're in. Colors are tuned for the
// solid forest-green header (light on dark), not the white body below it.
export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-6 text-sm">
      {LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={
              active
                ? "font-medium text-white underline underline-offset-4 decoration-2"
                : "text-forest-100 hover:text-white"
            }
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
