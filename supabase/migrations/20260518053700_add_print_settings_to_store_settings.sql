-- Migration: Add print_settings JSONB column to store_settings
-- This allows print configuration (address, CNPJ, WhatsApp, PIX, Instagram, thank message)
-- to be stored in the database and synced across all devices for the same tenant.

ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS print_settings jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.store_settings.print_settings IS
  'JSON blob containing print customization: address, document, whatsapp, pixKey, instagram, thankMessage and visibility toggles.';
