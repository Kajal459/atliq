import Link from "next/link";
import { signOut } from "./actions";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream-50">
      <header className="border-b border-forest-100 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-8">
            <span className="font-serif text-2xl italic text-forest-600">atliq</span>
            <nav className="flex gap-6 text-sm text-gray-600">
              <Link href="/dashboard" className="hover:text-forest-600">
                Weekly Digest
              </Link>
              <Link href="/dashboard/approvals" className="hover:text-forest-600">
                Approval Inbox
              </Link>
              <Link href="/dashboard/deals" className="hover:text-forest-600">
                Deal Timeline
              </Link>
            </nav>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-full border border-forest-600 px-4 py-1.5 text-sm font-medium text-forest-600 hover:bg-forest-50"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
