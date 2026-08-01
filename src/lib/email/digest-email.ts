import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { buildWeeklyDigest } from "@/lib/digest/buckets";
import { listDigestRecipients } from "@/lib/digest/recipients";
import { signQuickAction } from "@/lib/auth/quick-action-token";
import { SIGNAL_TYPE_META, SIGNAL_TYPE_PRIORITY, headlineForSignal } from "@/lib/automation/describe-signal";
import { sendEmail } from "./resend-send";

type PendingApprovalWithDeal = Prisma.SignalGetPayload<{ include: { deal: true } }>;

// The push half of "why delivery can't just be a URL people should check"
// (see 03 - Architecture doc). Sent once a day by the cron job to whoever's
// listed as a DigestRecipient (managed from Settings) - lands in an inbox
// habit that already exists instead of a new tab to remember.

const MAX_APPROVALS_IN_EMAIL = 6;

export async function sendDailyDigestEmail(): Promise<{ sent: number; recipients: string[] }> {
  const recipients = await listDigestRecipients();
  if (recipients.length === 0) return { sent: 0, recipients: [] };

  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  const digest = await buildWeeklyDigest();
  const totalPending = await prisma.signal.count({ where: { status: "pending" } });
  const allPending = await prisma.signal.findMany({
    where: { status: "pending" },
    include: { deal: true },
    orderBy: { createdAt: "asc" },
  });
  allPending.sort((a, b) => {
    const pa = SIGNAL_TYPE_PRIORITY[a.type] ?? 9;
    const pb = SIGNAL_TYPE_PRIORITY[b.type] ?? 9;
    return pa !== pb ? pa - pb : a.createdAt.getTime() - b.createdAt.getTime();
  });
  const pendingApprovals = allPending.slice(0, MAX_APPROVALS_IN_EMAIL);
  const overflowCount = totalPending - pendingApprovals.length;

  const atRiskItems = [...digest.buckets.today, ...digest.buckets.stale, ...digest.buckets.needsReview];

  for (const recipient of recipients) {
    const html = buildDigestHtml({ base, digest, atRiskItems, pendingApprovals, overflowCount, recipientName: recipient.name });
    await sendEmail({
      to: recipient.email,
      subject: `AtliQ digest - ${formatUsd(digest.atRiskValueUsd)} at risk across ${digest.atRiskDealCount} deal(s)`,
      html,
    });
  }

  return { sent: recipients.length, recipients: recipients.map((r) => r.email) };
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function buildDigestHtml(params: {
  base: string;
  digest: Awaited<ReturnType<typeof buildWeeklyDigest>>;
  atRiskItems: { company: string; reason: string; dealId: string }[];
  pendingApprovals: PendingApprovalWithDeal[];
  overflowCount: number;
  recipientName: string;
}): string {
  const { base, digest, atRiskItems, pendingApprovals, overflowCount, recipientName } = params;

  const rows = atRiskItems
    .slice(0, 10)
    .map(
      (item) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #EAF3EE;"><strong>${escapeHtml(item.company)}</strong><br><span style="color:#666;font-size:13px;">${escapeHtml(item.reason)}</span></td></tr>`
    )
    .join("");

  const approvalRows = pendingApprovals
    .map((s) => {
      const meta = SIGNAL_TYPE_META[s.type] ?? { icon: "•", label: s.type.replace(/_/g, " ") };
      const approveUrl = `${base}/api/quick-approve?token=${signQuickAction({ signalId: s.id, action: "approve", actor: recipientName })}`;
      const rejectUrl = `${base}/api/quick-approve?token=${signQuickAction({ signalId: s.id, action: "reject", actor: recipientName })}`;
      return `<tr><td style="padding:10px 0;border-bottom:1px solid #EAF3EE;">
        <span style="display:inline-block;background:#EAF3EE;color:#1F4D3D;font-size:11px;font-weight:600;text-transform:uppercase;padding:2px 8px;border-radius:999px;margin-bottom:4px;">${meta.icon} ${escapeHtml(meta.label)}</span><br>
        <strong>${escapeHtml(headlineForSignal(s))}</strong><br>
        <span style="color:#666;font-size:13px;">"${escapeHtml(s.citationQuote)}"</span><br>
        <a href="${approveUrl}" style="display:inline-block;margin-top:6px;margin-right:8px;background:#1F4D3D;color:white;padding:6px 14px;border-radius:999px;text-decoration:none;font-size:13px;">Approve</a>
        <a href="${rejectUrl}" style="display:inline-block;margin-top:6px;border:1px solid #ccc;color:#555;padding:6px 14px;border-radius:999px;text-decoration:none;font-size:13px;">Reject</a>
      </td></tr>`;
    })
    .join("");
  const overflowNote =
    overflowCount > 0
      ? `<p style="margin-top:10px;font-size:13px;color:#666;">+ ${overflowCount} more waiting — <a href="${base}/dashboard/approvals" style="color:#1F4D3D;font-weight:600;">see the rest in the Approval Inbox →</a></p>`
      : "";

  return `<!DOCTYPE html>
<html><body style="font-family:-apple-system,Arial,sans-serif;background:#FDF6EF;margin:0;padding:24px;color:#1a2e26;">
<div style="max-width:560px;margin:0 auto;background:white;border-radius:16px;padding:24px;border:1px solid #CFE6DA;">
  <p style="font-size:22px;font-style:italic;color:#1F4D3D;margin:0 0 16px;font-family:Georgia,serif;">atliq</p>
  <p>Morning, ${escapeHtml(recipientName)}.</p>

  <div style="background:#EAF3EE;border-radius:12px;padding:16px;margin:16px 0;">
    <p style="font-size:13px;text-transform:uppercase;color:#1F4D3D;margin:0;">Pipeline value at risk</p>
    <p style="font-size:24px;margin:4px 0 0;font-family:Georgia,serif;">${formatUsd(digest.atRiskValueUsd)} <span style="font-size:14px;color:#666;">across ${digest.atRiskDealCount} deal(s)</span></p>
  </div>

  ${rows ? `<h3 style="font-size:14px;text-transform:uppercase;color:#888;">Needs attention</h3><table style="width:100%;border-collapse:collapse;">${rows}</table>` : ""}
  ${approvalRows ? `<h3 style="font-size:14px;text-transform:uppercase;color:#888;margin-top:20px;">Waiting on your approval</h3><table style="width:100%;border-collapse:collapse;">${approvalRows}</table>${overflowNote}` : ""}

  <p style="margin-top:24px;"><a href="${base}/dashboard" style="background:#1F4D3D;color:white;padding:10px 20px;border-radius:999px;text-decoration:none;font-size:14px;">Open full dashboard</a></p>
</div>
</body></html>`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
