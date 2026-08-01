"use server";

import { revalidatePath } from "next/cache";
import { sendDailyDigestEmail } from "@/lib/email/digest-email";
import {
  addDigestRecipient,
  removeDigestRecipient,
  setDailyDigestEnabled,
} from "@/lib/digest/recipients";

// All the server-side actions behind the "Daily digest email" section in
// Settings - sending a manual test, managing who's on the list, and the
// on/off switch for the automatic cron-triggered send. (File name kept as
// "digest-test-actions" rather than renamed, since this sandbox can't
// rename/delete files on this mount.)

export async function sendTestDigest(): Promise<{ ok: boolean; message: string }> {
  if (!process.env.RESEND_API_KEY) {
    return {
      ok: false,
      message: "RESEND_API_KEY isn't set yet - add it to .env.local and restart the dev server.",
    };
  }

  try {
    const result = await sendDailyDigestEmail();
    if (result.sent === 0) {
      return { ok: false, message: "Nothing sent - add at least one recipient below first." };
    }
    return { ok: true, message: `Sent to ${result.recipients.join(", ")}.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Send failed for an unknown reason." };
  }
}

export async function addRecipient(formData: FormData): Promise<{ ok: boolean; message: string }> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  if (!email || !email.includes("@")) {
    return { ok: false, message: "Enter a valid email address." };
  }

  try {
    await addDigestRecipient(name || email, email);
    revalidatePath("/dashboard/settings");
    return { ok: true, message: `Added ${email}.` };
  } catch (err) {
    const alreadyExists = err instanceof Error && err.message.includes("Unique constraint");
    return {
      ok: false,
      message: alreadyExists ? "That email is already on the list." : "Couldn't add that recipient.",
    };
  }
}

export async function removeRecipient(id: string): Promise<void> {
  await removeDigestRecipient(id);
  revalidatePath("/dashboard/settings");
}

export async function setDigestEnabled(enabled: boolean): Promise<void> {
  await setDailyDigestEnabled(enabled);
  revalidatePath("/dashboard/settings");
}
