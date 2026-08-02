-- AI-estimated success score for a deal, generated on demand.
ALTER TABLE "Deal" ADD COLUMN "successScore" INTEGER;
ALTER TABLE "Deal" ADD COLUMN "successScoreRationale" TEXT;
ALTER TABLE "Deal" ADD COLUMN "successScoreUpdatedAt" TIMESTAMP(3);
