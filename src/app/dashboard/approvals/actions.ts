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

// Bulk-approves every pending signal for one deal at once - the Approval
// Inbox's per-client summary row uses this for its single "Approve all"
// action, applying each signal's own proposed value exactly as extracted
// (no per-message editing here - that only happens one at a time on the
// deal's own page). Runs sequentially, not in parallel, since multiple
// signals can touch the same deal record.
export async function submitBulkApproval(signalIds: string[], actor: string): Promise<{ ok: boolean }> {
  if (!actor) {
    throw new Error("Select who is taking this action before submitting.");
  }
  for (const signalId of signalIds) {
    await resolveApproval(signalId, "approve", actor);
  }
  revalidatePath("/dashboard/approvals");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/digest");
  revalidatePath("/dashboard/deals");
  return { ok: true };
}

// Bulk-rejects every pending signal for one deal at once - the counterpart
// to submitBulkApproval, offered from the same per-client menu on the main
// Approval Inbox page.
export async function submitBulkReject(signalIds: string[], actor: string): Promise<{ ok: boolean }> {
  if (!actor) {
    throw new Error("Select who is taking this action before submitting.");
  }
  for (const signalId of signalIds) {
    await resolveApproval(signalId, "reject", actor);
  }
  revalidatePath("/dashboard/approvals");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/digest");
  revalidatePath("/dashboard/deals");
  return { ok: true };
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
