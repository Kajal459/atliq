"use server";

import { revalidatePath } from "next/cache";
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
}
