-- CreateEnum
CREATE TYPE "DealStage" AS ENUM ('New', 'Contacted', 'Qualified', 'ProposalSent', 'Negotiation', 'ComplianceProcurement', 'VerbalAgreement', 'Won', 'Lost');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('email', 'meeting_note', 'founder_reply');

-- CreateEnum
CREATE TYPE "SignalType" AS ENUM ('new_lead', 'deadline', 'negotiation_flag', 'deferral', 'stage_change', 'cross_sell', 'disqualification', 'owner_assignment', 'duplicate_merge');

-- CreateEnum
CREATE TYPE "SignalTier" AS ENUM ('auto_apply', 'approval_required', 'needs_review');

-- CreateEnum
CREATE TYPE "SignalStatus" AS ENUM ('pending', 'approved', 'rejected', 'auto_applied', 'needs_review', 'edited');

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "source" TEXT,
    "serviceInterest" TEXT,
    "stage" "DealStage" NOT NULL DEFAULT 'New',
    "estValueUsd" DOUBLE PRECISION,
    "owner" TEXT,
    "createdDate" TIMESTAMP(3),
    "lastContactDate" TIMESTAMP(3),
    "nextFollowupDate" TIMESTAMP(3),
    "notes" TEXT,
    "stale" BOOLEAN NOT NULL DEFAULT false,
    "staleSince" TIMESTAMP(3),
    "mergedIntoDealId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceEvent" (
    "id" TEXT NOT NULL,
    "dealId" TEXT,
    "type" "SourceType" NOT NULL,
    "filename" TEXT,
    "occurredAt" TIMESTAMP(3),
    "fromWhom" TEXT,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signal" (
    "id" TEXT NOT NULL,
    "sourceEventId" TEXT NOT NULL,
    "dealId" TEXT,
    "type" "SignalType" NOT NULL,
    "field" TEXT,
    "proposedValue" TEXT,
    "previousValue" TEXT,
    "citationQuote" TEXT NOT NULL,
    "confidence" TEXT NOT NULL DEFAULT 'high',
    "tier" "SignalTier" NOT NULL,
    "status" "SignalStatus" NOT NULL DEFAULT 'pending',
    "reasoning" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "dealId" TEXT,
    "action" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Deal_leadId_key" ON "Deal"("leadId");

-- AddForeignKey
ALTER TABLE "SourceEvent" ADD CONSTRAINT "SourceEvent_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_sourceEventId_fkey" FOREIGN KEY ("sourceEventId") REFERENCES "SourceEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
