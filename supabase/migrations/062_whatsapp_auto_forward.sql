-- ============================================================
-- Migration 062: WhatsApp Auto-Forward to Admin
-- Adds forward_to_phone and forward_enabled columns to whatsapp_config.
-- ============================================================

ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS forward_to_phone TEXT,
  ADD COLUMN IF NOT EXISTS forward_enabled BOOLEAN NOT NULL DEFAULT false;
