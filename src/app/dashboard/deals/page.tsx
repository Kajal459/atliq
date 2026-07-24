import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DealsListPage() {
  const deals = await prisma.deal.findMany({
    where: { mergedIntoDealId: null },
    orderBy: [{ stale: "desc" }, { updatedAt: "desc" }],
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-ink">Deal Timeline</h1>
        <p className="mt-1 text-sm text-gray-500">
          Every deal, with its CRM record, email threads, and meeting notes merged into one thread - each claim
          linked back to its source.
        </p>
      </div>

      <div className="overflow-hidden rounded border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2">Company</th>
              <th className="px-4 py-2">Stage</th>
              <th className="px-4 py-2">Owner</th>
              <th className="px-4 py-2">Value</th>
              <th className="px-4 py-2">Next follow-up</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {deals.map((deal) => (
              <tr key={deal.id} className="hover:bg-gray-50">
                <td className="px-4 py-2">
                  <Link href={`/dashboard/deals/${deal.id}`} className="font-medium text-accent hover:underline">
                    {deal.company}
                  </Link>
                  {deal.stale && (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">stale</span>
                  )}
                </td>
                <td className="px-4 py-2">{deal.stage}</td>
                <td className="px-4 py-2">{deal.owner ?? <span className="text-gray-400">unassigned</span>}</td>
                <td className="px-4 py-2">{deal.estValueUsd ? `$${deal.estValueUsd.toLocaleString()}` : "-"}</td>
                <td className="px-4 py-2">
                  {deal.nextFollowupDate ? deal.nextFollowupDate.toISOString().slice(0, 10) : "-"}
                </td>
                <td className="px-4 py-2 text-right text-xs text-gray-400">{deal.leadId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
