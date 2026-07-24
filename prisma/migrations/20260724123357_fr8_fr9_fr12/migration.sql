-- AlterEnum
ALTER TYPE "SignalType" ADD VALUE 'deferral_reminder';

-- AlterTable
ALTER TABLE "Signal" ADD COLUMN "suggestedServiceLine" TEXT,
ADD COLUMN "leadSource" TEXT;
