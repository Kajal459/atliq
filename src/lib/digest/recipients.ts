import { prisma } from "@/lib/db";

// Fixed id for the one settings row - simpler than a real key-value table
// for a single on/off switch.
const DIGEST_SETTING_ID = "digest";

export async function listDigestRecipients() {
  return prisma.digestRecipient.findMany({ orderBy: { createdAt: "asc" } });
}

export async function addDigestRecipient(name: string, email: string) {
  return prisma.digestRecipient.create({ data: { name, email } });
}

export async function removeDigestRecipient(id: string) {
  await prisma.digestRecipient.delete({ where: { id } });
}

export async function isDailyDigestEnabled(): Promise<boolean> {
  const setting = await prisma.digestSetting.findUnique({ where: { id: DIGEST_SETTING_ID } });
  // No row yet = never toggled = defaults to on.
  return setting?.enabled ?? true;
}

export async function setDailyDigestEnabled(enabled: boolean) {
  await prisma.digestSetting.upsert({
    where: { id: DIGEST_SETTING_ID },
    update: { enabled },
    create: { id: DIGEST_SETTING_ID, enabled },
  });
}
