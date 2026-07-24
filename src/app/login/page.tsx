import { login } from "./actions";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string };
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        <h1 className="text-lg font-bold text-ink">AtliQ Sales Memory Assistant</h1>
        <p className="mt-1 text-sm text-gray-500">
          Shared access for Dhaval, Bhavin, Karandeep, and Jay.
        </p>

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
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>
          {searchParams.error && (
            <p className="text-sm text-warn">That password didn&apos;t match. Try again.</p>
          )}
          <button
            type="submit"
            className="w-full rounded bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}
