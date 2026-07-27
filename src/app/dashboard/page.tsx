import Link from "next/link";
import { buildDashboardOverview } from "@/lib/dashboard/overview";

export const dynamic = "force-dynamic";

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export default async function DashboardHomePage() {
  const o = await buildDashboardOverview();
  const maxStageCount = Math.max(1, ...o.stageBreakdown.map((s) => s.count));
  const maxOwnerCount = Math.max(1, ...o.ownerBreakdown.map((s) => s.count));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl text-ink">Home</h1>
        <p className="mt-1 text-sm text-gray-500">The state of the book, at a glance - the numbers behind the digest.</p>
      </div>

      {/* Headline KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Open pipeline" value={formatUsd(o.openPipelineValueUsd)} sub={`${o.openDealCount} deal${o.openDealCount === 1 ? "" : "s"}`} />
        <Link href="/dashboard/approvals" className="block">
          <KpiCard label="Pending approvals" value={String(o.pendingApprovalCount)} sub="in the Approval Inbox" highlight={o.pendingApprovalCount > 0} />
        </Link>
        <Link href="/dashboard/deals" className="block">
          <KpiCard label="Stale deals" value={String(o.staleCount)} sub={o.staleCount > 0 ? formatUsd(o.staleValueUsd) + " at risk" : "none right now"} highlight={o.staleCount > 0} />
        </Link>
        <KpiCard
          label="Win rate"
          value={o.winRatePct !== null ? `${o.winRatePct}%` : "—"}
          sub={`${o.wonCount} won · ${o.lostCount} lost`}
        />
      </div>

      {o.needsReviewCount > 0 && (
        <p className="rounded-lg border border-amber-300 bg-amber-100 px-4 py-2 text-sm text-amber-900">
          {o.needsReviewCount} deal{o.needsReviewCount === 1 ? "" : "s"} moved backward and need a look - see the{" "}
          <Link href="/dashboard/digest" className="font-medium underline">
            Weekly Digest
          </Link>
          .
        </p>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Pipeline by stage */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">Pipeline by stage</h2>
          <div className="mt-4 space-y-2.5">
            {o.stageBreakdown.map((s) => (
              <div key={s.stage}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ink">{s.stage}</span>
                  <span className="text-gray-500">
                    {s.count} · {formatUsd(s.valueUsd)}
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-gray-100">
                  <div
                    className="h-1.5 rounded-full bg-forest-500"
                    style={{ width: `${(s.count / maxStageCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Workload by owner */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">Open deals by owner</h2>
          <div className="mt-4 space-y-2.5">
            {o.ownerBreakdown.map((ow) => (
              <div key={ow.owner}>
                <div className="flex items-center justify-between text-sm">
                  <span className={ow.owner === "Unassigned" ? "text-gray-400" : "text-ink"}>{ow.owner}</span>
                  <span className="text-gray-500">
                    {ow.count} · {formatUsd(ow.valueUsd)}
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-gray-100">
                  <div
                    className={`h-1.5 rounded-full ${ow.owner === "Unassigned" ? "bg-amber-400" : "bg-forest-500"}`}
                    style={{ width: `${(ow.count / maxOwnerCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pending approvals by type */}
      {o.signalTypeBreakdown.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">Waiting on your approval</h2>
            <Link href="/dashboard/approvals" className="text-xs font-medium text-forest-600 hover:underline">
              Open Approval Inbox →
            </Link>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {o.signalTypeBreakdown.map((t) => (
              <span key={t.type} className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-600">
                {t.icon} {t.count} {t.label.toLowerCase()}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`h-full rounded-xl border p-4 ${
        highlight ? "border-amber-300 bg-amber-100" : "border-gray-200 bg-white"
      }`}
    >
      <p className={`text-xs font-medium uppercase tracking-wide ${highlight ? "text-amber-700" : "text-gray-500"}`}>
        {label}
      </p>
      <p className={`mt-1 font-serif text-2xl ${highlight ? "text-amber-900" : "text-ink"}`}>{value}</p>
      <p className={`mt-0.5 text-xs ${highlight ? "text-amber-700" : "text-gray-500"}`}>{sub}</p>
    </div>
  );
}
