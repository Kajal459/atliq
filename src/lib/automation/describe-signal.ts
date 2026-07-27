import { initialStageForSource } from "./tiers";

// Shared plain-English framing for a pending Signal, used by both the
// Approval Inbox page and the daily digest email so a founder sees the same
// wording either way - "Move Meridian Health: Negotiation -> Won" instead of
// a raw field name and value, which is what actually needs approving.

export type DescribableSignal = {
  type: string;
  field: string | null;
  proposedValue: string | null;
  previousValue: string | null;
  leadSource: string | null;
  suggestedServiceLine: string | null;
  deal: { company: string } | null;
  sourceEvent?: { subject: string | null } | null;
};

export const SIGNAL_TYPE_META: Record<string, { icon: string; label: string }> = {
  new_lead: { icon: "🆕", label: "New lead" },
  deferral_reminder: { icon: "🔔", label: "Reminder due" },
  stage_change: { icon: "➡️", label: "Stage move" },
  deadline: { icon: "⏰", label: "Deadline" },
  negotiation_flag: { icon: "🤝", label: "Negotiation" },
  disqualification: { icon: "🚫", label: "Disqualification" },
  cross_sell: { icon: "💡", label: "Cross-sell" },
  deferral: { icon: "📌", label: "Follow-up set" },
};

// Priority for scanning/sorting - new business and time-sensitive reminders
// first, ambiguous flags last.
export const SIGNAL_TYPE_PRIORITY: Record<string, number> = {
  new_lead: 0,
  deferral_reminder: 1,
  stage_change: 2,
  deadline: 3,
  negotiation_flag: 4,
  disqualification: 5,
  cross_sell: 6,
};

export function headlineForSignal(signal: DescribableSignal): string {
  const company = signal.deal?.company ?? signal.sourceEvent?.subject ?? "Unmatched item";

  switch (signal.type) {
    case "new_lead": {
      const stage = initialStageForSource(signal.leadSource);
      return `New lead — "${company}"${signal.leadSource ? ` via ${signal.leadSource}` : ""}. Starts at ${stage}.`;
    }
    case "stage_change":
      return `Move ${company}: ${signal.previousValue ?? "current stage"} → ${signal.proposedValue}`;
    case "deadline":
      return `${company} has a deadline coming up`;
    case "negotiation_flag":
      return `${company} raised a negotiation point`;
    case "deferral":
      return `${company} asked for a follow-up later`;
    case "deferral_reminder":
      return `Follow-up is due for ${company} — reply drafted`;
    case "cross_sell":
      return signal.suggestedServiceLine
        ? `${company} might be a fit for ${signal.suggestedServiceLine}`
        : `${company} might be a cross-sell fit`;
    case "disqualification":
      return `${company} may be disqualifying itself`;
    default:
      return `${company} — ${signal.type.replace(/_/g, " ")}`;
  }
}
