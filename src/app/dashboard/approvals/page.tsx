import { prisma } from "@/lib/db";
import { OWNERS } from "@/lib/automation/owner";
import { SIGNAL_TYPE_META, SIGNAL_TYPE_PRIORITY, headlineForSignal } from "@/lib/automation/describe-signal";
import { submitApproval } from "./actions";

export const dynamic = "force-dynamic";

type SignalWithRelations = Awaited<ReturnType<typeof prisma.signal.findMany>>[number] & {
  deal: { company: string } | null;
  sourceEvent: { filename: string | null; subject: string | null } | null;
};

export default async function ApprovalInboxPage() {
  const signals = (await prisma.signal.findMany({
    where: { status: "pending" },
    include: { deal: true, sourceEvent: { select: { filename: true, subject: true } } },
    orderBy: { createdAt: "asc" },
  })) as SignalWithRelations[];

  signals.sort((a, b) => {
    const pa = SIGNAL_TYPE_PRIORITY[a.type] ?? 9;
    const pb = SIGNAL_TYPE_PRIORITY[b.type] ?? 9;
    return pa !== pb ? pa - pb : a.createdAt.getTime() - b.createdAt.getTime();
  });

  const counts = signals.reduce<Record<string, number>>((acc, s) => {
    acc[s.type] = (acc[s.type] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl text-ink">Approval Inbox</h1>
        <p className="mt-1 text-sm text-gray-500">
          Nothing is written, sent, or scheduled until someone taps Approve. Sorted so the highest-value items -
          new leads and due reminders - come first.
        </p>
        {signals.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-forest-600 px-3 py-1 font-medium text-white">
              {signals.length} waiting
            </span>
            {Object.entries(counts).map(([type, count]) => (
              <span key={type} className="rounded-full border border-gray-200 bg-white px-3 py-1 text-gray-600">
                {SIGNAL_TYPE_META[type]?.icon ?? "•"} {count} {SIGNAL_TYPE_META[type]?.label.toLowerCase() ?? type}
              </span>
            ))}
          </div>
        )}
      </div>

      {signals.length === 0 && (
        <p className="rounded border border-gray-200 bg-white p-4 text-sm text-gray-500">
          Nothing pending right now.
        </p>
      )}

      <div className="space-y-3">
        {signals.map((signal) => (
          <ApprovalCard key={signal.id} signal={signal} />
        ))}
      </div>

      {/* Remembers "Acting as" in this browser so it isn't re-picked on every single approval. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function () {
              var KEY = "atliq-actor";
              var saved = localStorage.getItem(KEY);
              var selects = document.querySelectorAll('select[name="actor"]');
              if (saved) selects.forEach(function (s) { s.value = saved; });
              selects.forEach(function (s) {
                s.addEventListener("change", function () {
                  localStorage.setItem(KEY, s.value);
                  selects.forEach(function (other) { other.value = s.value; });
                });
              });
            })();
          `,
        }}
      />
    </div>
  );
}

function ApprovalCard({ signal }: { signal: SignalWithRelations }) {
  const meta = SIGNAL_TYPE_META[signal.type] ?? { icon: "•", label: signal.type.replace(/_/g, " ") };
  const hasEditableField = Boolean(signal.field);
  const hasEditableDraft = !signal.field && signal.type === "deferral_reminder" && Boolean(signal.proposedValue);

  return (
    <form action={submitApproval} className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
      <input type="hidden" name="signalId" value={signal.id} />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 text-base">{meta.icon}</span>
          <div>
            <span className="mr-2 rounded-full bg-forest-50 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-forest-700">
              {meta.label}
            </span>
            <p className="mt-1 font-medium leading-snug text-ink">{headlineForSignal(signal)}</p>
          </div>
        </div>
        {signal.confidence === "low" && (
          <span className="whitespace-nowrap rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            low confidence
          </span>
        )}
      </div>

      <details className="mt-2 ml-7">
        <summary className="cursor-pointer text-xs font-medium text-forest-600">Why is this here?</summary>
        <div className="mt-2 space-y-1.5">
          <p className="rounded bg-gray-50 p-2 text-gray-700">&ldquo;{signal.citationQuote}&rdquo;</p>
          {signal.reasoning && <p className="text-xs text-gray-500">{signal.reasoning}</p>}
          <p className="text-xs text-gray-400">Source: {signal.sourceEvent?.filename ?? "system"}</p>
        </div>
      </details>

      {hasEditableField && (
        <div className="mt-3 ml-7 flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">{signal.field}:</label>
          <input
            name="editedValue"
            defaultValue={signal.proposedValue ?? ""}
            className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </div>
      )}

      {hasEditableDraft && (
        <div className="mt-3 ml-7 space-y-1">
          <label className="text-xs font-medium text-gray-500">Drafted email (edit before sending yourself):</label>
          <textarea
            name="editedValue"
            defaultValue={signal.proposedValue ?? ""}
            rows={5}
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </div>
      )}

      <div className="mt-3 ml-7 flex items-center justify-between border-t border-gray-100 pt-3">
        <select name="actor" required defaultValue="" className="rounded border border-gray-300 px-2 py-1 text-xs">
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
            className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            Reject
          </button>
          {(hasEditableField || hasEditableDraft) && (
            <button
              type="submit"
              name="action"
              value="edit"
              className="rounded-full border border-forest-600 px-3 py-1.5 text-xs font-medium text-forest-600 hover:bg-forest-50"
            >
              Edit &amp; Approve
            </button>
          )}
          <button
            type="submit"
            name="action"
            value="approve"
            className="rounded-full bg-forest-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-forest-700"
          >
            Approve
          </button>
        </div>
      </div>
    </form>
  );
}
