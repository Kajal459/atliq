import { config } from "dotenv";
config({ path: ".env.local" });

import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { prisma } from "@/lib/db";
import { extractSignals } from "@/lib/extraction/extract";
import { applyExtractionResult } from "@/lib/automation/apply";
import { resolveDuplicatesForCompany } from "@/lib/automation/dedupe";
import { refreshStaleFlags } from "@/lib/automation/stale";
import { assignOwnerIfBlank } from "@/lib/automation/owner";

// One-time backfill: seed the 40 existing CRM rows directly (they ARE the
// system of record's starting point, not something to re-extract), then run
// every email and meeting note through the single-pass extraction core in
// chronological order so the AI Core's audit trail reads the same way it
// would have unfolded live. ~49 real Claude calls (34 emails + 15 notes) -
// matches the volume assumption used in the cost estimation worksheet.

const DATA_DIR = path.join(process.cwd(), "data");

type CrmRow = {
  lead_id: string;
  company: string;
  contact_name: string;
  contact_email: string;
  source: string;
  service_interest: string;
  status: string;
  est_value_usd: string;
  owner: string;
  created_date: string;
  last_contact_date: string;
  next_followup_date: string;
  notes: string;
};

const STATUS_TO_STAGE: Record<string, string> = {
  New: "New",
  Contacted: "Contacted",
  Qualified: "Qualified",
  "Proposal Sent": "ProposalSent",
  Negotiation: "Negotiation",
  "Compliance & Procurement": "ComplianceProcurement",
  "Verbal Agreement": "VerbalAgreement",
  Won: "Won",
  Lost: "Lost",
};

async function main() {
  console.log("=== Step 1: seeding CRM records ===");
  const deals = await seedCrmRows();
  console.log(`Seeded ${deals.length} CRM records.`);

  console.log("\n=== Step 2: loading source events (emails + meeting notes) ===");
  const events = loadSourceFiles();
  console.log(`Found ${events.length} source files.`);

  console.log("\n=== Step 3: running single-pass extraction over each event (chronological order) ===");
  events.sort((a, b) => (a.occurredAt?.getTime() ?? 0) - (b.occurredAt?.getTime() ?? 0));

  let processed = 0;
  for (const event of events) {
    // Idempotency: safe to re-run backfill after a partial failure. A
    // SourceEvent with this filename that already has processedAt set was
    // already fully handled last run - skip it rather than duplicating
    // signals and re-triggering auto-applied changes a second time.
    const existing = await prisma.sourceEvent.findFirst({ where: { filename: event.filename } });
    if (existing?.processedAt) {
      console.log(`  [skip - already processed] ${event.filename}`);
      continue;
    }

    const matchedDeal = matchDealByText(`${event.subject ?? ""}\n${event.body}`, deals);

    const created = existing
      ? existing
      : await prisma.sourceEvent.create({
          data: {
            type: event.type,
            filename: event.filename,
            occurredAt: event.occurredAt,
            fromWhom: event.fromWhom,
            subject: event.subject,
            body: event.body,
            dealId: matchedDeal?.id ?? null,
          },
        });

    try {
      const result = await extractSignals({
        sourceType: event.type,
        filename: event.filename,
        occurredAt: event.occurredAt?.toISOString() ?? null,
        fromWhom: event.fromWhom,
        subject: event.subject,
        body: event.body,
        dealContext: matchedDeal ? dealContextString(matchedDeal) : null,
      });
      const outcome = await applyExtractionResult(created.id, result);
      processed++;
      console.log(
        `  [${processed}/${events.length}] ${event.filename} -> deal=${outcome.dealId ?? "(unmatched)"} signals=${outcome.created} auto-applied=${outcome.autoApplied}`
      );
    } catch (err) {
      console.error(`  FAILED on ${event.filename}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log("\n=== Step 4: resolving duplicates per company ===");
  const companies = [...new Set(deals.map((d) => d.company))];
  for (const company of companies) {
    await resolveDuplicatesForCompany(company);
  }

  console.log("\n=== Step 5: assigning owners on any still-blank records ===");
  const stillBlank = await prisma.deal.findMany({ where: { owner: null, mergedIntoDealId: null } });
  for (const d of stillBlank) {
    const assigned = await assignOwnerIfBlank(d.id);
    if (assigned) console.log(`  ${d.company} -> ${assigned}`);
  }

  console.log("\n=== Step 6: flagging stale deals (30+ days no activity) ===");
  const staleCount = await refreshStaleFlags();
  console.log(`  ${staleCount} deals flagged stale.`);

  console.log("\nBackfill complete.");
}

async function seedCrmRows() {
  const csvPath = path.join(DATA_DIR, "crm_export.csv");
  const raw = fs.readFileSync(csvPath, "utf-8");
  const rows: CrmRow[] = parse(raw, { columns: true, skip_empty_lines: true });

  const results = [];
  for (const row of rows) {
    const stage = STATUS_TO_STAGE[row.status] ?? "New";
    const deal = await prisma.deal.upsert({
      where: { leadId: row.lead_id },
      update: {},
      create: {
        leadId: row.lead_id,
        company: row.company,
        contactName: row.contact_name || null,
        contactEmail: row.contact_email || null,
        source: row.source || null,
        serviceInterest: row.service_interest || null,
        stage: stage as never,
        estValueUsd: row.est_value_usd ? Number(row.est_value_usd) : null,
        owner: row.owner || null,
        createdDate: row.created_date ? new Date(row.created_date) : null,
        lastContactDate: row.last_contact_date ? new Date(row.last_contact_date) : null,
        nextFollowupDate: row.next_followup_date ? new Date(row.next_followup_date) : null,
        notes: row.notes || null,
      },
    });
    results.push(deal);
  }
  return results;
}

function loadSourceFiles() {
  const results: {
    type: "email" | "meeting_note";
    filename: string;
    body: string;
    subject: string | null;
    fromWhom: string | null;
    occurredAt: Date | null;
  }[] = [];

  for (const [dir, type] of [
    ["emails", "email"],
    ["meeting_notes", "meeting_note"],
  ] as const) {
    const full = path.join(DATA_DIR, dir);
    if (!fs.existsSync(full)) continue;
    for (const filename of fs.readdirSync(full)) {
      if (!filename.endsWith(".md")) continue;
      const body = fs.readFileSync(path.join(full, filename), "utf-8");
      const subjectMatch = body.match(/^#\s*(.+)$/m);
      const fromMatch = body.match(/\*\*From:\*\*\s*(.+)$/m);
      const dateMatch = filename.match(/^(\d{4}-\d{2}-\d{2})/);
      results.push({
        type,
        filename: `${dir}/${filename}`,
        body,
        subject: subjectMatch ? subjectMatch[1].trim() : null,
        fromWhom: fromMatch ? fromMatch[1].trim() : null,
        occurredAt: dateMatch ? new Date(dateMatch[1]) : null,
      });
    }
  }
  return results;
}

function matchDealByText<T extends { company: string }>(text: string, deals: T[]): T | null {
  const lower = text.toLowerCase();
  // Longest company name first, so "Meridian Healthcare" wins over a
  // coincidental shorter substring match.
  const sorted = [...deals].sort((a, b) => b.company.length - a.company.length);
  return sorted.find((d) => lower.includes(d.company.toLowerCase())) ?? null;
}

function dealContextString(deal: {
  leadId: string;
  company: string;
  stage: string;
  estValueUsd: number | null;
  owner: string | null;
  serviceInterest: string | null;
  notes: string | null;
}) {
  return `lead_id: ${deal.leadId}\ncompany: ${deal.company}\ncurrent_stage: ${deal.stage}\nest_value_usd: ${deal.estValueUsd ?? "unknown"}\nowner: ${deal.owner ?? "unassigned"}\nservice_interest: ${deal.serviceInterest ?? "unknown"}\nexisting_notes: ${deal.notes ?? "(none)"}`;
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
