import Link from "next/link";
import { buildWeeklyDigest, type DigestBucket, type DigestItem } from "@/lib/digest/buckets";

export const dynamic = "force-dynamic";

const BUCKET_LABELS: Record<DigestBucket, string> = {
  today: "Due today (or overdue)",
  next2weeks: "Due within 2 weeks",
  later: "Further out",
  stale: "Stale (30+ days no activity)",
  needsReview: "Needs Review (backward stage movement)",
};

const BUCKET_ORDER: DigestBucket[] = ["today", "next2weeks", "needsReview", "stale", "later"];

export default async function WeeklyDigestPage() {
  const digest = await buildWeeklyDigest();
  const totalItems = Object.values(digest).reduce((sum, items) => sum + items.length, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-ink">Weekly Digest</h1>
        <p className="mt-1 text-sm text-gray-500">
          What needs attention, grouped by time horizon instead of one flat list - the view that replaces ~2
          hours/month of manually reconciling the CRM against everyone&apos;s inboxes.
        </p>
      </div>

      {totalItems === 0 && (
        <p className="rounded border border-gray-200 bg-white p-4 text-sm text-gray-500">
          Nothing needs attention right now - or the backfill hasn&apos;t been run yet. See the README for{" "}
          <code className="rounded bg-gray-100 px-1">npm run backfill</code>.
        </p>
      )}

      {BUCKET_ORDER.map((bucket) =>
        digest[bucket].length > 0 ? (
          <section key={bucket}>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">
              {BUCKET_LABELS[bucket]} ({digest[bucket].length})
            </h2>
            <div className="divide-y divide-gray-100 rounded border border-gray-200 bg-white">
              {digest[bucket].map((item, i) => (
                <DigestRow key={`${item.dealId}-${i}`} item={item} />
              ))}
            </div>
          </section>
        ) : null
      )}
    </div>
  );
}

function DigestRow({ item }: { item: DigestItem }) {
  return (
    <Link
      href={`/dashboard/deals/${item.dealId}`}
      className="flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50"
    >
      <div>
        <p className="font-medium text-ink">{item.company}</p>
        <p className="text-gray-500">{item.reason}</p>
      </div>
      <span className="text-xs text-gray-400">{item.owner ?? "unassigned"}</span>
    </Link>
  );
}
