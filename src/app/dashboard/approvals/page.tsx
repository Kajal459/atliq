import { prisma } from "@/lib/db";
import { OWNERS } from "@/lib/automation/owner";
import { submitApproval } from "./actions";

export const dynamic = "force-dynamic";

export default async function ApprovalInboxPage() {
  const signals = await prisma.signal.findMany({
    where: { status: "pending" },
    include: { deal: true, sourceEvent: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Approval Inbox</h1>
        <p className="mt-1 text-sm text-gray-500">
          Every proposed change waits here: field, new value, reason, and citation. Nothing is written, sent, or
          scheduled until someone taps Approve.
        </p>
      </div>

      {signals.length === 0 && (
        <p className="rounded border border-gray-200 bg-white p-4 text-sm text-gray-500">
          Nothing pending right now.
        </p>
      )}

      <div className="space-y-4">
        {signals.map((signal) => (
          <ApprovalCard key={signal.id} signal={signal} />
        ))}
      </div>
    </div>
  );
}

function ApprovalCard({
  signal,
}: {
  signal: Awaited<ReturnType<typeof prisma.signal.findMany>>[number] & {
    deal: { company: string } | null;
    sourceEvent: { filename: string | null } | null;
  };
}) {
  return (
    <form
      action={submitApproval}
      className="space-y-3 rounded border border-gray-200 bg-white p-4 text-sm"
    >
      <input type="hidden" name="signalId" value={signal.id} />

      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-ink">
            {signal.deal?.company ?? "(no matched deal)"} <span className="text-gray-400">- {signal.type.replace(/_/g, " ")}</span>
          </p>
          <p className="text-xs text-gray-400">{signal.sourceEvent?.filename ?? "system"}</p>
        </div>
        {signal.confidence === "low" && (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            low confidence - best guess
          </span>
        )}
      </div>

      <p className="rounded bg-gray-50 p-2 text-gray-700">&ldquo;{signal.citationQuote}&rdquo;</p>
      <p className="text-gray-600">{signal.reasoning}</p>

      {signal.suggestedServiceLine && (
        <p className="text-xs text-gray-500">
          Suggested fit: <span className="font-medium text-ink">{signal.suggestedServiceLine}</span>
        </p>
      )}
      {signal.leadSource && (
        <p className="text-xs text-gray-500">
          Source: <span className="font-medium text-ink">{signal.leadSource}</span> - will start at{" "}
          <span className="font-medium text-ink">
            {signal.leadSource.toLowerCase().includes("referral") || signal.leadSource.toLowerCase().includes("partner")
              ? "Qualified"
              : "New"}
          </span>
        </p>
      )}

      {signal.field && (
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">
            {signal.field}:
          </label>
          <input
            name="editedValue"
            defaultValue={signal.proposedValue ?? ""}
            className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </div>
      )}

      {!signal.field && signal.type === "deferral_reminder" && signal.proposedValue && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Drafted email (edit before sending yourself):</label>
          <textarea
            name="editedValue"
            defaultValue={signal.proposedValue}
            rows={6}
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <select
          name="actor"
          required
          defaultValue=""
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="" disabled>
            Acting as...
          </option>
          {OWNERS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>

        <div className="flex gap-2">
          <button
            type="submit"
            name="action"
            value="reject"
            className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            Reject
          </button>
          <button
            type="submit"
            name="action"
            value="edit"
            className="rounded border border-accent px-3 py-1.5 text-xs font-medium text-accent hover:bg-blue-50"
          >
            Edit &amp; Approve
          </button>
          <button
            type="submit"
            name="action"
            value="approve"
            className="rounded bg-good px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
          >
            Approve
          </button>
        </div>
      </div>
    </form>
  );
}
