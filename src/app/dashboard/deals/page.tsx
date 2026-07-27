import Link from "next/link";
import { prisma } from "@/lib/db";
import { OWNERS } from "@/lib/automation/owner";
import { STAGE_ORDER } from "@/lib/automation/tiers";

export const dynamic = "force-dynamic";

// Sort rank used only for the "Stage" column header click - pipeline order,
// with the two terminal stages appended at the end rather than mixed in.
const FULL_STAGE_ORDER = [...STAGE_ORDER, "Won", "Lost"];
function stageSortRank(stage: string): number {
  const idx = FULL_STAGE_ORDER.indexOf(stage as (typeof FULL_STAGE_ORDER)[number]);
  return idx === -1 ? 999 : idx;
}

export default async function DealsListPage() {
  const deals = await prisma.deal.findMany({
    where: { mergedIntoDealId: null },
    orderBy: [{ stale: "desc" }, { updatedAt: "desc" }],
  });

  const stagesPresent = Array.from(new Set(deals.map((d) => d.stage))).sort(
    (a, b) => stageSortRank(a) - stageSortRank(b)
  );
  const ownersPresent = OWNERS.filter((o) => deals.some((d) => d.owner === o));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl text-ink">Deal Timeline</h1>
        <p className="mt-1 text-sm text-gray-500">
          Every deal, with its CRM record, email threads, and meeting notes merged into one thread - each claim
          linked back to its source.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2" id="deal-filters">
        <input
          type="text"
          id="deal-search"
          placeholder="Search company..."
          className="rounded border border-gray-300 px-3 py-1.5 text-sm"
        />
        <select id="stage-filter" className="rounded border border-gray-300 px-2 py-1.5 text-sm">
          <option value="all">All stages</option>
          {stagesPresent.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select id="owner-filter" className="rounded border border-gray-300 px-2 py-1.5 text-sm">
          <option value="all">All owners</option>
          <option value="__unassigned">Unassigned</option>
          {ownersPresent.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600">
          <input type="checkbox" id="stale-filter" />
          Stale only
        </label>
        <button
          type="button"
          id="clear-filters"
          className="text-sm text-gray-400 underline hover:text-gray-600"
        >
          Clear
        </button>
        <span id="deal-count" className="ml-auto text-xs text-gray-400">
          {deals.length} deals
        </span>
      </div>

      <div className="overflow-hidden rounded border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2"><button type="button" className="sort-btn" data-sort="company">Company ⇅</button></th>
              <th className="px-4 py-2"><button type="button" className="sort-btn" data-sort="stage">Stage ⇅</button></th>
              <th className="px-4 py-2"><button type="button" className="sort-btn" data-sort="owner">Owner ⇅</button></th>
              <th className="px-4 py-2"><button type="button" className="sort-btn" data-sort="value">Value ⇅</button></th>
              <th className="px-4 py-2"><button type="button" className="sort-btn" data-sort="followup">Next follow-up ⇅</button></th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100" id="deal-rows">
            {deals.map((deal) => (
              <tr
                key={deal.id}
                className="hover:bg-gray-50"
                data-company={deal.company.toLowerCase()}
                data-stage={deal.stage}
                data-stage-rank={stageSortRank(deal.stage)}
                data-owner={deal.owner ?? ""}
                data-stale={deal.stale ? "1" : "0"}
                data-value={deal.estValueUsd ?? -1}
                data-followup={deal.nextFollowupDate ? deal.nextFollowupDate.toISOString().slice(0, 10) : ""}
              >
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
        <p id="deal-no-match" className="hidden p-4 text-sm text-gray-500">
          No deals match these filters.
        </p>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function () {
              var rows = Array.prototype.slice.call(document.querySelectorAll("#deal-rows tr"));
              var search = document.getElementById("deal-search");
              var stageFilter = document.getElementById("stage-filter");
              var ownerFilter = document.getElementById("owner-filter");
              var staleFilter = document.getElementById("stale-filter");
              var clearBtn = document.getElementById("clear-filters");
              var noMatch = document.getElementById("deal-no-match");
              var countLabel = document.getElementById("deal-count");
              var sortBtns = document.querySelectorAll(".sort-btn");
              var sortState = { key: null, dir: 1 };

              function applyFilters() {
                var q = search.value.trim().toLowerCase();
                var stage = stageFilter.value;
                var owner = ownerFilter.value;
                var staleOnly = staleFilter.checked;
                var visible = 0;
                rows.forEach(function (row) {
                  var matches =
                    (!q || row.getAttribute("data-company").indexOf(q) !== -1) &&
                    (stage === "all" || row.getAttribute("data-stage") === stage) &&
                    (owner === "all" ||
                      (owner === "__unassigned" ? row.getAttribute("data-owner") === "" : row.getAttribute("data-owner") === owner)) &&
                    (!staleOnly || row.getAttribute("data-stale") === "1");
                  row.style.display = matches ? "" : "none";
                  if (matches) visible++;
                });
                noMatch.classList.toggle("hidden", visible !== 0);
                countLabel.textContent = visible + " of " + rows.length + " deals";
              }

              function sortBy(key) {
                var tbody = document.getElementById("deal-rows");
                var attrMap = { company: "data-company", stage: "data-stage-rank", owner: "data-owner", value: "data-value", followup: "data-followup" };
                var attr = attrMap[key];
                var numeric = key === "stage" || key === "value";
                sortState.dir = sortState.key === key ? -sortState.dir : 1;
                sortState.key = key;
                var sorted = rows.slice().sort(function (a, b) {
                  var av = a.getAttribute(attr);
                  var bv = b.getAttribute(attr);
                  var aEmpty = av === "" || av === null;
                  var bEmpty = bv === "" || bv === null;
                  if (aEmpty && bEmpty) return 0;
                  if (aEmpty) return 1;
                  if (bEmpty) return -1;
                  if (numeric) { av = parseFloat(av); bv = parseFloat(bv); }
                  if (av < bv) return -1 * sortState.dir;
                  if (av > bv) return 1 * sortState.dir;
                  return 0;
                });
                sorted.forEach(function (row) { tbody.appendChild(row); });
              }

              search.addEventListener("input", applyFilters);
              stageFilter.addEventListener("change", applyFilters);
              ownerFilter.addEventListener("change", applyFilters);
              staleFilter.addEventListener("change", applyFilters);
              clearBtn.addEventListener("click", function () {
                search.value = "";
                stageFilter.value = "all";
                ownerFilter.value = "all";
                staleFilter.checked = false;
                applyFilters();
              });
              sortBtns.forEach(function (btn) {
                btn.addEventListener("click", function () { sortBy(btn.getAttribute("data-sort")); });
              });
            })();
          `,
        }}
      />
    </div>
  );
}
