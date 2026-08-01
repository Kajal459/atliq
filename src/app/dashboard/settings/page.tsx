import { SendTestDigestButton } from "./_SendTestDigestButton";
import { DigestRecipients } from "./_DigestRecipients";
import { listDigestRecipients, isDailyDigestEnabled } from "@/lib/digest/recipients";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [recipients, enabled] = await Promise.all([listDigestRecipients(), isDailyDigestEnabled()]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-2xl italic text-ink">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Connections and integrations for the whole team.</p>
      </div>

      <section className="rounded-xl border border-cream-100 bg-white p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">Daily digest email</h2>

        <DigestRecipients recipients={recipients} enabled={enabled} />

        <div className="mt-4 border-t border-gray-100 pt-4">
          <SendTestDigestButton />
        </div>
      </section>
    </div>
  );
}
