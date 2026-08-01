import Link from "next/link";
import { signOut } from "./actions";
import { NavLinks } from "./_components/NavLinks";
import { ConfirmButton } from "./_components/ConfirmButton";
import { QuickCaptureLauncher } from "./_components/QuickCaptureLauncher";
import { Footer } from "@/components/Footer";
import { AtliqLogo } from "@/components/AtliqLogo";
import { OWNERS } from "@/lib/automation/owner";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Fetched here (not per-page) so the "attach to a specific deal" dropdown
  // in Quick Capture is available from anywhere in the dashboard, not just
  // Home - it's a light query (id + company only) and layouts already
  // re-render on navigation the same way pages do.
  const deals = await prisma.deal.findMany({
    where: { mergedIntoDealId: null },
    select: { id: true, company: true },
    orderBy: { company: "asc" },
  });

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="bg-forest-700">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-8">
            <Link href="/dashboard">
              <AtliqLogo />
            </Link>
            <NavLinks />
          </div>
          <ConfirmButton
            label="Sign out"
            confirmText="Sign out of the shared AtliQ dashboard?"
            confirmLabel="Sign out"
            tone="neutral"
            onConfirm={signOut}
            className="rounded-full border border-cream-100 px-4 py-1.5 text-sm font-medium text-cream-100 hover:bg-forest-600"
          />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
        <QuickCaptureLauncher owners={OWNERS} deals={deals} />
      </main>
      <Footer />
    </div>
  );
}
