import { prisma } from "@/lib/db";
import { OWNERS } from "./owner";
import { initialStageForSource } from "./tiers";

// Approval Inbox actions. Since v1 has one shared admin role rather than
// per-user logins, the acting founder's name is passed explicitly from the
// UI (a simple dropdown) rather than derived from a session - good enough
// for a 4-person internal tool, and still gives the audit trail a real name
// instead of "admin".

export type ApprovalAction = "approve" | "reject" | "edit";

export async function resolveApproval(
  signalId: string,
  action: ApprovalAction,
  actor: string,
  editedValue?: string
): Promise<void> {
  const signal = await prisma.signal.findUniqueOrThrow({ where: { id: signalId } });
  if (signal.status !== "pending" && signal.status !== "needs_review") {
    throw new Error(`Signal ${signalId} has already been resolved (status: ${signal.status}).`);
  }

  if (action === "reject") {
    await prisma.$transaction([
      prisma.signal.update({
        where: { id: signalId },
        data: { status: "rejected", resolvedAt: new Date(), resolvedBy: actor },
      }),
      // A rejected deferral_reminder still needs its trigger cleared, or the
      // next cron run just regenerates the same reminder tomorrow.
      ...(signal.type === "deferral_reminder" && signal.dealId
        ? [prisma.deal.update({ where: { id: signal.dealId }, data: { nextFollowupDate: null } })]
        : []),
      prisma.auditLog.create({
        data: {
          dealId: signal.dealId,
          action: "approval_rejected",
          detail: `${actor} rejected: ${signal.type} - "${signal.citationQuote}"`,
          actor,
        },
      }),
    ]);
    return;
  }

  const finalValue = action === "edit" ? editedValue ?? signal.proposedValue : signal.proposedValue;

  await applyApprovedSignal(signal, finalValue, actor);
}

async function applyApprovedSignal(
  signal: Awaited<ReturnType<typeof prisma.signal.findUniqueOrThrow>>,
  finalValue: string | null,
  actor: string
): Promise<void> {
  const newStatus = finalValue !== signal.proposedValue ? "edited" : "approved";

  if (signal.type === "new_lead") {
    // Approving a new_lead signal is what actually creates the CRM record -
    // it was only ever a proposal until now.
    const sourceEvent = await prisma.sourceEvent.findUniqueOrThrow({ where: { id: signal.sourceEventId } });
    const company = finalValue || sourceEvent.subject || "Unnamed lead";
    const stage = initialStageForSource(signal.leadSource);
    const deal = await prisma.deal.create({
      data: {
        leadId: `NEW-${Date.now()}`,
        company,
        source: signal.leadSource,
        stage,
        createdDate: new Date(),
        notes: `Created from approved new_lead signal. Source: ${sourceEvent.filename ?? sourceEvent.type}.`,
      },
    });
    await prisma.$transaction([
      prisma.signal.update({
        where: { id: signal.id },
        data: { status: newStatus, dealId: deal.id, resolvedAt: new Date(), resolvedBy: actor },
      }),
      prisma.auditLog.create({
        data: {
          dealId: deal.id,
          action: "new_lead_created",
          detail: `${actor} approved new lead "${company}" from ${sourceEvent.filename ?? sourceEvent.type} - started at "${stage}" (source: ${signal.leadSource ?? "unknown"}).`,
          actor,
        },
      }),
    ]);
    return;
  }

  if (!signal.dealId) {
    // No deal to write the change to (e.g. a disqualification/cross-sell
    // signal on an unmatched event) - just record the approval decision.
    await prisma.$transaction([
      prisma.signal.update({
        where: { id: signal.id },
        data: { status: newStatus, resolvedAt: new Date(), resolvedBy: actor },
      }),
      prisma.auditLog.create({
        data: {
          action: "approval_approved_no_deal",
          detail: `${actor} ${newStatus === "edited" ? "edited and approved" : "approved"} ${signal.type} with no linked deal${
            newStatus === "edited" ? ` - updated to: "${finalValue}"` : ""
          } - "${signal.citationQuote}"`,
          actor,
        },
      }),
    ]);
    return;
  }

  const updateData = fieldUpdateFor(signal.field, finalValue);
  // Approving the drafted reach-back email means the founder is about to act
  // on it - clear the date so the cron job doesn't regenerate the same
  // reminder again tomorrow. A fresh deferral later will set a new date.
  if (signal.type === "deferral_reminder") {
    updateData.nextFollowupDate = null;
  }

  await prisma.$transaction([
    ...(Object.keys(updateData).length > 0
      ? [prisma.deal.update({ where: { id: signal.dealId }, data: updateData })]
      : []),
    prisma.signal.update({
      where: { id: signal.id },
      data: { status: newStatus, resolvedAt: new Date(), resolvedBy: actor },
    }),
    prisma.auditLog.create({
      data: {
        dealId: signal.dealId,
        action: "approval_approved",
        detail: `${actor} ${newStatus === "edited" ? "edited and approved" : "approved"}: ${signal.type}${
          newStatus === "edited"
            ? ` - updated to: "${finalValue}"`
            : signal.field
              ? ` (${signal.field} -> ${finalValue})`
              : ""
        } - "${signal.citationQuote}"`,
        actor,
      },
    }),
  ]);
}

function fieldUpdateFor(field: string | null, value: string | null): Record<string, unknown> {
  if (!field || value == null) return {};
  switch (field) {
    case "stage":
    case "status":
      return { stage: value };
    case "next_followup_date":
      return { nextFollowupDate: new Date(value) };
    case "owner":
      return OWNERS.includes(value as (typeof OWNERS)[number]) ? { owner: value } : {};
    default:
      // Unknown/free-text fields (e.g. deadline, negotiation note) are kept
      // on the signal record itself for the Deal Timeline to display, rather
      // than shoehorned into a CRM column that doesn't exist for it.
      return {};
  }
}
