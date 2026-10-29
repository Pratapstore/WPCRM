-- ============================================================
-- Migration 061: WhatsApp Commerce Bot & Payment Gateways
-- Adds payment_gateways, order_sessions, RLS, and guards.
-- ============================================================

-- 1. PAYMENT GATEWAYS TABLE
CREATE TABLE IF NOT EXISTS payment_gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE UNIQUE,
  provider TEXT NOT NULL DEFAULT 'razorpay',
  key_id TEXT,
  key_secret TEXT,
  webhook_secret TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  enable_cod BOOLEAN NOT NULL DEFAULT true,
  enable_prepaid BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_gateways_account_id ON payment_gateways(account_id);

ALTER TABLE payment_gateways ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_gateways_select ON payment_gateways;
DROP POLICY IF EXISTS payment_gateways_insert ON payment_gateways;
DROP POLICY IF EXISTS payment_gateways_update ON payment_gateways;
DROP POLICY IF EXISTS payment_gateways_delete ON payment_gateways;

CREATE POLICY payment_gateways_select ON payment_gateways FOR SELECT USING (is_account_member(account_id));
CREATE POLICY payment_gateways_insert ON payment_gateways FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));
CREATE POLICY payment_gateways_update ON payment_gateways FOR UPDATE USING (is_account_member(account_id, 'admin'));
CREATE POLICY payment_gateways_delete ON payment_gateways FOR DELETE USING (is_account_member(account_id, 'admin'));

DROP TRIGGER IF EXISTS set_updated_at ON payment_gateways;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON payment_gateways
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. ORDER SESSIONS TABLE (Active conversational shopping cart)
CREATE TABLE IF NOT EXISTS order_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  state TEXT NOT NULL DEFAULT 'IDLE',
  selected_product JSONB NOT NULL DEFAULT '{}'::jsonb,
  quantity INTEGER NOT NULL DEFAULT 1,
  shipping_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(account_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_order_sessions_account_contact ON order_sessions(account_id, contact_id);

ALTER TABLE order_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_sessions_select ON order_sessions;
DROP POLICY IF EXISTS order_sessions_insert ON order_sessions;
DROP POLICY IF EXISTS order_sessions_update ON order_sessions;
DROP POLICY IF EXISTS order_sessions_delete ON order_sessions;

CREATE POLICY order_sessions_select ON order_sessions FOR SELECT USING (is_account_member(account_id));
CREATE POLICY order_sessions_insert ON order_sessions FOR INSERT WITH CHECK (is_account_member(account_id, 'agent'));
CREATE POLICY order_sessions_update ON order_sessions FOR UPDATE USING (is_account_member(account_id, 'agent'));
CREATE POLICY order_sessions_delete ON order_sessions FOR DELETE USING (is_account_member(account_id, 'agent'));

DROP TRIGGER IF EXISTS set_updated_at ON order_sessions;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON order_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. UPDATE redeem_invitation TO GUARD payment_gateways AND order_sessions
CREATE OR REPLACE FUNCTION public.redeem_invitation(
  p_token_hash TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_inv account_invitations%ROWTYPE;
  v_old_account_id UUID;
  v_old_account_owner UUID;
  v_has_other_members BOOLEAN;
  v_has_data BOOLEAN;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_inv
  FROM account_invitations
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found' USING ERRCODE = '22023';
  END IF;
  IF v_inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation has already been redeemed'
      USING ERRCODE = '22023';
  END IF;
  IF v_inv.expires_at <= NOW() THEN
    RAISE EXCEPTION 'Invitation has expired' USING ERRCODE = '22023';
  END IF;

  SELECT p.account_id, a.owner_user_id
  INTO v_old_account_id, v_old_account_owner
  FROM profiles p
  JOIN accounts a ON a.id = p.account_id
  WHERE p.user_id = v_caller_id
  FOR UPDATE OF p, a;

  IF v_old_account_id IS NULL THEN
    RAISE EXCEPTION 'Caller has no profile' USING ERRCODE = '42501';
  END IF;

  IF v_old_account_id = v_inv.account_id THEN
    RAISE EXCEPTION 'You are already a member of this account'
      USING ERRCODE = '23505';
  END IF;

  IF v_old_account_owner <> v_caller_id THEN
    RAISE EXCEPTION 'You are already in a shared account; sign up with a different email to join this one'
      USING ERRCODE = '23505';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE account_id = v_old_account_id
      AND user_id <> v_caller_id
  ) INTO v_has_other_members;

  IF v_has_other_members THEN
    RAISE EXCEPTION 'Your account has other members; remove them or transfer ownership before joining another account'
      USING ERRCODE = '23505';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM contacts WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM conversations WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM broadcasts WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM automations WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM automation_logs WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM automation_pending_executions WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM flows WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM flow_runs WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM pipelines WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM deals WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM message_templates WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM tags WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM custom_fields WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM contact_notes WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM whatsapp_config WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM api_keys WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM webhook_endpoints WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM quick_replies WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM notifications WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM ai_configs WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM ai_knowledge_documents WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM ai_knowledge_chunks WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM ai_usage_log WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM products WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM orders WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM payment_gateways WHERE account_id = v_old_account_id
    UNION ALL SELECT 1 FROM order_sessions WHERE account_id = v_old_account_id
    LIMIT 1
  ) INTO v_has_data;

  IF v_has_data THEN
    RAISE EXCEPTION 'Your account already contains data; sign up with a different email to join this one'
      USING ERRCODE = '23505';
  END IF;

  UPDATE profiles
  SET account_id = v_inv.account_id,
      account_role = v_inv.role
  WHERE user_id = v_caller_id;

  UPDATE account_invitations
  SET accepted_at = NOW(),
      accepted_by_user_id = v_caller_id
  WHERE id = v_inv.id;

  DELETE FROM accounts WHERE id = v_old_account_id;

  RETURN v_inv.account_id;
END;
$$;

ALTER FUNCTION public.redeem_invitation(TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.redeem_invitation(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_invitation(TEXT) TO authenticated;
