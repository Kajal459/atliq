import { z } from "zod";

// Every applicable signal type is extracted in ONE call per source event
// (single-pass architecture - see 03 - Architecture doc for why multi-pass
// was considered and rejected on cost grounds).

export const ExtractedSignalSchema = z.object({
  type: z.enum([
    "new_lead",
    "deadline",
    "negotiation_flag",
    "deferral",
    "stage_change",
    "cross_sell",
    "disqualification",
  ]),
  field: z.string().nullable().describe("CRM field affected, if any, e.g. 'stage', 'next_followup_date'"),
  proposed_value: z.string().nullable().describe("The proposed new value, as a plain string"),
  citation_quote: z.string().describe("The exact quoted line(s) from the source text this was extracted from"),
  confidence: z.enum(["high", "low"]).describe("'low' if the source note was ambiguous and this is a best-guess"),
  reasoning: z.string().describe("One sentence explaining the signal for a founder reviewing it in the Approval Inbox"),
  suggested_service_line: z
    .string()
    .nullable()
    .describe("Only for cross_sell signals: one of Power BI Dashboards, AI/ML Solutions, Data Engineering, Custom Web App, Staff Augmentation"),
  lead_source: z
    .string()
    .nullable()
    .describe(
      "Only for new_lead signals: the channel this lead came through (e.g. 'Referral', 'LinkedIn', 'Website', 'Conference', 'Cold outreach', 'Channel partner'). Drives whether the lead starts at New or Qualified."
    ),
});

export type ExtractedSignal = z.infer<typeof ExtractedSignalSchema>;

export const ExtractionResultSchema = z.object({
  matched_deal_hint: z
    .string()
    .nullable()
    .describe("Company name or lead_id this event most likely relates to, if any"),
  signals: z.array(ExtractedSignalSchema),
});

export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;
