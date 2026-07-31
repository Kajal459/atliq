import { NextRequest, NextResponse } from "next/server";
import { verifyQuickAction } from "@/lib/auth/quick-action-token";
import { resolveApproval } from "@/lib/automation/approvals";

// The landing page for a one-tap Approve/Reject link clicked from the daily
// digest email - no login required, the signed token itself is the proof of
// authorization (see quick-action-token.ts). Renders a plain HTML page since
// this is opened directly in a browser from an email client, not fetched by
// the dashboard's own JS.

function page(title: string, body: string): NextResponse {
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
body { font-family: -apple-system, Inter, sans-serif; background: #FDF6EF; color: #1a2e26; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; }
.card { max-width: 420px; background: white; border: 1px solid #CFE6DA; border-radius: 16px; padding: 32px; text-align: center; }
h1 { font-size: 20px; margin: 0 0 8px; }
p { color: #555; font-size: 14px; }
a { display: inline-block; margin-top: 16px; background: #1F4D3D; color: white; padding: 10px 20px; border-radius: 999px; text-decoration: none; font-size: 14px; }
</style></head>
<body><div class="card"><h1>${title}</h1>${body}</div></body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html" } });
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const base = process.env.APP_BASE_URL || "http://localhost:3000";

  if (!token) {
    return page("Link missing its token", `<p>This link looks incomplete. Open the dashboard instead.</p><a href="${base}/dashboard/approvals">Open Approval Inbox</a>`);
  }

  const payload = verifyQuickAction(token);
  if (!payload) {
    return page("This link has expired", `<p>Quick-approve links are valid for 14 days. Open the dashboard to handle this item instead.</p><a href="${base}/dashboard/approvals">Open Approval Inbox</a>`);
  }

  try {
    await resolveApproval(payload.signalId, payload.action, payload.actor);
    return page(
      payload.action === "approve" ? "Approved" : "Rejected",
      `<p>Recorded as ${payload.actor}. You can review the change in the Deal Timeline.</p><a href="${base}/dashboard">Open dashboard</a>`
    );
  } catch (err) {
    return page(
      "Already handled",
      `<p>This item was already resolved - probably from the dashboard already. No action needed.</p><a href="${base}/dashboard/approvals">Open Approval Inbox</a>`
    );
  }
}
