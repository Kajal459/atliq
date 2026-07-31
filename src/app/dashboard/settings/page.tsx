import { prisma } from "@/lib/db";
import { SyncButton } from "./_SyncButton";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  missing_code: "Google didn't return an authorization code - try connecting again.",
  no_refresh_token: "Google didn't return a refresh token. Revoke AtliQ's access at myaccount.google.com/permissions and try connecting again.",
  exchange_failed: "Couldn't complete the connection - check the server logs for details.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { gmail_connected?: string; gmail_error?: string };
}) {
  const connection = await prisma.gmailConnection.findFirst({ orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl text-ink">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Connections and integrations for the whole team.</p>
      </div>

      {searchParams.gmail_connected && (
        <p className="rounded-lg border border-forest-100 bg-forest-50 p-3 text-sm text-forest-700">
          Gmail connected. New emails will be checked daily, or right now with the button below.
        </p>
      )}
      {searchParams.gmail_error && (
        <p className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-warn">
          {ERROR_MESSAGES[searchParams.gmail_error] ?? "Something went wrong connecting Gmail."}
        </p>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">Gmail</h2>
        <p className="mt-1 text-sm text-gray-600">
          The one live integration - watches a real inbox so new emails feed the same extraction pipeline as the
          backfilled dataset, and (once set up) sends the daily digest.
        </p>

        {connection ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-ink">
              Connected as <span className="font-medium">{connection.emailAddress}</span>
            </p>
            <p className="text-xs text-gray-500">
              Last checked: {connection.lastSyncedAt ? connection.lastSyncedAt.toISOString().slice(0, 16).replace("T", " ") : "never"}
            </p>
            <SyncButton />
          </div>
        ) : (
          <a
            href="/api/gmail/connect"
            className="mt-4 inline-block rounded-full bg-forest-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-forest-700"
          >
            Connect Gmail
          </a>
        )}
      </section>
    </div>
  );
}
