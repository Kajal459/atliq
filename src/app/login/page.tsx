import { login } from "./actions";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string };
}) {
  return (
    <main className="flex min-h-screen flex-col bg-cream-100">
      <header className="border-b border-forest-100 bg-white px-6 py-4">
        <span className="font-serif text-2xl italic text-forest-600">atliq</span>
      </header>

      <div className="flex flex-1 items-center px-6 py-16">
        <div className="mx-auto grid w-full max-w-4xl gap-12 md:grid-cols-2 md:items-center">
          <div>
            <h1 className="text-4xl leading-tight text-forest-900 md:text-5xl">
              Find the <span className="font-serif italic">follow-up</span>
              <br />
              before it <span className="font-serif italic">goes cold</span>
            </h1>
            <p className="mt-5 max-w-sm text-gray-600">
              Shared access for Dhaval, Bhavin, Karandeep, and Jay - every signal captured, cited, and waiting for
              approval.
            </p>
          </div>

          <div className="w-full max-w-sm rounded-2xl bg-white p-8 md:justify-self-end">
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
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-forest-600 focus:outline-none"
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
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
