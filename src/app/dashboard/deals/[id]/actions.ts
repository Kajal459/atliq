"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

// Manual override for a deal's next-follow-up date, for when a founder
// wants to set or clear it directly rather than waiting for the extraction
// pipeline to infer one from a deferral signal (see the Approval Inbox's
// deferral cards for that automatic path). Both paths write to the same
// Deal.nextFollowupDate column, so the Weekly Digest and the daily cron
// reminder pick up either one identically.
export async function setDealFollowupDate(
  dealId: string,
  date: string,
  actor: string
): Promise<{ ok: boolean; message: string }> {
  if (!actor) {
    return { ok: false, message: "Select who is making this change first." };
  }

  const nextFollowupDate = date ? new Date(date) : null;
  await prisma.deal.update({ where: { id: dealId }, data: { nextFollowupDate } });
  await prisma.auditLog.create({
    data: {
      dealId,
      action: "followup_date_set_manually",
      detail: date ? `Next follow-up set to ${date}.` : "Next follow-up cleared.",
      actor,
    },
  });

  revalidatePath(`/dashboard/deals/${dealId}`);
  revalidatePath("/dashboard/deals");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/digest");

  return { ok: true, message: date ? `Follow-up set to ${date}.` : "Follow-up cleared." };
}

// Assigns or reassigns which team member owns this deal - separate from
// "acting as" (who is performing an action right now, for the audit log).
// This is the actual Deal.owner column shown as the "Owner" field.
export async function setDealOwner(
  dealId: string,
  owner: string,
  actor: string
): Promise<{ ok: boolean; message: string }> {
  if (!actor) {
    return { ok: false, message: "Select who is making this change first." };
  }

  const deal = await prisma.deal.findUnique({ where: { id: dealId }, select: { owner: true } });
  await prisma.deal.update({ where: { id: dealId }, data: { owner } });
  await prisma.auditLog.create({
    data: {
      dealId,
      action: "owner_reassigned",
      detail: deal?.owner ? `Owner changed from ${deal.owner} to ${owner}.` : `Owner set to ${owner}.`,
      actor,
    },
  });

  revalidatePath(`/dashboard/deals/${dealId}`);
  revalidatePath("/dashboard/deals");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/digest");

  return { ok: true, message: `Owner set to ${owner}.` };
}
