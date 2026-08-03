import { login } from "./actions";
import { Footer } from "@/components/Footer";
import { AtliqLogo } from "@/components/AtliqLogo";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string };
}) {
  return (
    <main className="flex min-h-screen flex-col bg-white">
      <header className="bg-forest-700 px-6 py-4">
        <AtliqLogo />
      </header>

      <div className="flex flex-1 items-center px-6 py-16">
        <div className="mx-auto grid w-full max-w-4xl gap-12 md:grid-cols-2 md:items-center">
          <div>
            <h1 className="text-4xl leading-tight text-forest-900 md:text-5xl">
              Find the <span className="font-serif italic">follow-up</span>
              <br />
              before it <span className="font-serif italic">goes cold</span>
            </h1>
          </div>

          <div className="w-full max-w-sm rounded-2xl border border-cream-100 bg-white p-8 md:justify-self-end">
            <h2 className="text-lg font-medium text-ink">Sign in</h2>
            <p className="mt-1 text-sm text-gray-500">Team password required.</p>

            <form action={login} className="mt-6 space-y-4">
              <input type="hidden" name="next" value={searchParams.next ?? "/dashboard"} />
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Team password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoFocus
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-forest-600"
                />
              </div>
              {searchParams.error && (
                <p className="text-sm text-warn">That password didn&apos;t match. Try again.</p>
              )}
              <button
                type="submit"
                className="w-full rounded-full bg-forest-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-forest-700"
              >
                Sign in
              </button>
              <p className="text-center text-xs text-gray-400">Demo Password: Admin123$</p>
            </form>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}
