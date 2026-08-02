"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { resolveApproval, type ApprovalAction } from "@/lib/automation/approvals";

export async function submitApproval(formData: FormData) {
  const signalId = String(formData.get("signalId"));
  const action = String(formData.get("action")) as ApprovalAction;
  const actor = String(formData.get("actor") ?? "");
  const editedValue = formData.get("editedValue");

  if (!actor) {
    throw new Error("Select who is taking this action before submitting.");
  }

  await resolveApproval(signalId, action, actor, editedValue ? String(editedValue) : undefined);
  revalidatePath("/dashboard/approvals");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/digest");
  revalidatePath("/dashboard/deals");
}

// Saves a reviewer's free-text note on a still-pending signal, independent
// of Approve/Reject/Edit - so context can be jotted down without forcing a
// decision on the item yet. No confirmation dialog: unlike Approve/Reject,
// this never changes the CRM or resolves the item.
export async function saveReviewerNote(signalId: string, note: string): Promise<{ ok: boolean }> {
  await prisma.signal.update({
    where: { id: signalId },
    data: { reviewerNote: note.trim() || null },
  });
  revalidatePath("/dashboard/approvals");
  return { ok: true };
}
