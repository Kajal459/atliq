"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { STAGE_ORDER } from "@/lib/automation/tiers";

export interface DealRow {
  id: string;
  leadId: string;
  company: string;
  stage: string;
  owner: string | null;
  estValueUsd: number | null;
  nextFollowupDate: string | null; // ISO date, e.g. "2026-08-01"
  stale: boolean;
}

type SortKey = "company" | "stage" | "owner" | "value" | "followup";

// Pipeline order for the "Stage" column - Won/Lost appended at the end
// rather than sorted alphabetically in with the active stages.
const FULL_STAGE_ORDER = [...STAGE_ORDER, "Won", "Lost"];
function stageSortRank(stage: string): number {
  const idx = FULL_STAGE_ORDER.indexOf(stage as (typeof FULL_STAGE_ORDER)[number]);
  return idx === -1 ? 999 : idx;
}

export function DealsTableClient({ deals, owners }: { deals: DealRow[]; owners: readonly string[] }) {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [staleOnly, setStaleOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const stagesPresent = useMemo(
    () => Array.from(new Set(deals.map((d) => d.stage))).sort((a, b) => stageSortRank(a) - stageSortRank(b)),
    [deals]
  );
  const ownersPresent = useMemo(() => owners.filter((o) => deals.some((d) => d.owner === o)), [deals, owners]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = deals.filter((d) => {
      return (
        (!q || d.company.toLowerCase().includes(q)) &&
        (stageFilter === "all" || d.stage === stageFilter) &&
        (ownerFilter === "all" || (ownerFilter === "__unassigned" ? !d.owner : d.owner === ownerFilter)) &&
        (!staleOnly || d.stale)
      );
    });

    if (sortKey) {
      rows = rows.slice().sort((a, b) => {
        const cmp = compareBy(sortKey, a, b);
        return cmp * sortDir;
      });
    }
    return rows;
  }, [deals, search, stageFilter, ownerFilter, staleOnly, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 1 ? -1 : 1) as 1 | -1);
    } else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  function clearFilters() {
    setSearch("");
    setStageFilter("all");
    setOwnerFilter("all");
    setStaleOnly(false);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search company..."
          className="rounded border border-gray-300 px-3 py-1.5 text-sm"
        />
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="all">All stages</option>
          {stagesPresent.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="all">All owners</option>
          <option value="__unassigned">Unassigned</option>
          {ownersPresent.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 rounded-full bg-cream-100 px-3 py-1.5 text-sm text-ink">
          <input type="checkbox" checked={staleOnly} onChange={(e) => setStaleOnly(e.target.checked)} />
          Stale only
        </label>
        <button type="button" onClick={clearFilters} className="text-sm text-gray-400 underline hover:text-gray-600">
          Clear
        </button>
        <span className="ml-auto text-xs text-gray-400">
          {visible.length} of {deals.length} deals
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl bg-cream-50">
        <table className="w-full text-sm">
          <thead className="bg-cream-100 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <SortableHeader label="Company" sortKey="company" active={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortableHeader label="Stage" sortKey="stage" active={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortableHeader label="Owner" sortKey="owner" active={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortableHeader label="Value" sortKey="value" active={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortableHeader label="Next follow-up" sortKey="followup" active={sortKey} dir={sortDir} onClick={toggleSort} />
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-100">
            {visible.map((deal) => (
              <tr key={deal.id} className="hover:bg-white">
                <td className="px-4 py-2">
                  <Link href={`/dashboard/deals/${deal.id}`} className="font-medium text-accent hover:underline">
                    {deal.company}
                  </Link>
                  {deal.stale && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">stale</span>
                  )}
                </td>
                <td className="px-4 py-2">{deal.stage}</td>
                <td className="px-4 py-2">{deal.owner ?? <span className="text-gray-400">unassigned</span>}</td>
                <td className="px-4 py-2">{deal.estValueUsd ? `$${deal.estValueUsd.toLocaleString()}` : "-"}</td>
                <td className="px-4 py-2">{deal.nextFollowupDate ?? "-"}</td>
                <td className="px-4 py-2 text-right text-xs text-gray-400">{deal.leadId}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && <p className="p-4 text-sm text-gray-500">No deals match these filters.</p>}
      </div>
    </div>
  );
}

function compareBy(key: SortKey, a: DealRow, b: DealRow): number {
  switch (key) {
    case "company":
      return a.company.toLowerCase().localeCompare(b.company.toLowerCase());
    case "stage":
      return stageSortRank(a.stage) - stageSortRank(b.stage);
    case "owner":
      if (!a.owner && !b.owner) return 0;
      if (!a.owner) return 1;
      if (!b.owner) return -1;
      return a.owner.localeCompare(b.owner);
    case "value": {
      const av = a.estValueUsd ?? -1;
      const bv = b.estValueUsd ?? -1;
      return av - bv;
    }
    case "followup":
      if (!a.nextFollowupDate && !b.nextFollowupDate) return 0;
      if (!a.nextFollowupDate) return 1;
      if (!b.nextFollowupDate) return -1;
      return a.nextFollowupDate.localeCompare(b.nextFollowupDate);
    default:
      return 0;
  }
}

function SortableHeader({
  label,
  sortKey,
  active,
  dir,
  onClick,
}: {
  label: string;
  sortKey: SortKey;
  active: SortKey | null;
  dir: 1 | -1;
  onClick: (key: SortKey) => void;
}) {
  const isActive = active === sortKey;
  return (
    <th className="px-4 py-2">
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className={`flex items-center gap-1 ${isActive ? "text-forest-700" : "text-gray-500"} hover:text-forest-700`}
      >
        {label} {isActive ? (dir === 1 ? "↑" : "↓") : "⇅"}
      </button>
    </th>
  );
}
