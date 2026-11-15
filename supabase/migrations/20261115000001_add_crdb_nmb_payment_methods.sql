-- ==============================================================================
-- MLOHUB MIGRATION: ADD CRDB & NMB BANK PAYMENT METHODS
-- Adds CRDB and NMB values to the payment_method_enum type idempotently.
-- ==============================================================================

DO $$
BEGIN
    ALTER TYPE payment_method_enum ADD VALUE IF NOT EXISTS 'CRDB';
    ALTER TYPE payment_method_enum ADD VALUE IF NOT EXISTS 'NMB';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
