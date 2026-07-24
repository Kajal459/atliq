import Link from "next/link";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-bold text-ink">AtliQ Sales Memory Assistant</p>
            <p className="text-xs text-gray-500">Internal prototype - shared admin access</p>
          </div>
          <nav className="flex gap-4 text-sm font-medium">
            <Link href="/dashboard" className="text-gray-600 hover:text-accent">
              Weekly Digest
            </Link>
            <Link href="/dashboard/approvals" className="text-gray-600 hover:text-accent">
              Approval Inbox
            </Link>
            <Link href="/dashboard/deals" className="text-gray-600 hover:text-accent">
              Deal Timeline
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
