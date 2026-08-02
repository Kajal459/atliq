-- Add a free-text reviewer note to Signal, independent of the proposed
-- value/date a signal already carries - lets a founder jot context on a
-- pending item without needing to Approve/Reject/Edit it first.
ALTER TABLE "Signal" ADD COLUMN "reviewerNote" TEXT;
