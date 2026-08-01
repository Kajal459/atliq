import { prisma } from "@/lib/db";
import { OWNERS } from "@/lib/automation/owner";
import { DealsTableClient, type DealRow } from "./DealsTableClient";

export const dynamic = "force-dynamic";

export default async function DealsListPage() {
  const deals = await prisma.deal.findMany({
    where: { mergedIntoDealId: null },
    orderBy: [{ stale: "desc" }, { updatedAt: "desc" }],
  });

  // Flatten to plain, serializable data (no Date objects) before handing
  // off to the client component that owns filtering/sorting state.
  const rows: DealRow[] = deals.map((d) => ({
    id: d.id,
    leadId: d.leadId,
    company: d.company,
    stage: d.stage,
    owner: d.owner,
    estValueUsd: d.estValueUsd,
    nextFollowupDate: d.nextFollowupDate ? d.nextFollowupDate.toISOString().slice(0, 10) : null,
    stale: d.stale,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-serif text-2xl italic text-ink">Deal Timeline</h1>
        <p className="mt-1 text-sm text-gray-500">
          Every deal, with its CRM record, email threads, and meeting notes merged into one thread - each claim
          linked back to its source.
        </p>
      </div>

      <DealsTableClient deals={rows} owners={OWNERS} />
    </div>
  );
}
