-- ============================================
-- Nano Banana Pro - Credit System Functions
-- ============================================
-- Migration: 20250108000002_credit_functions
-- Description: Create database functions for credit management

-- ============================================
-- Function: deduct_credits
-- Description: Deduct credits from user balance
-- Parameters:
--   p_user_id: UUID - User ID
--   p_amount: INTEGER - Amount to deduct
--   p_description: TEXT - Transaction description
--   p_metadata: JSONB - Additional metadata
-- Returns: TABLE with success status, new balance, and transaction ID
-- ============================================
CREATE OR REPLACE FUNCTION deduct_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_description TEXT,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE(
    success BOOLEAN,
    new_balance INTEGER,
    transaction_id UUID
) AS $$
DECLARE
    v_current_balance INTEGER;
    v_new_balance INTEGER;
    v_transaction_id UUID;
BEGIN
    -- Get current balance
    SELECT balance INTO v_current_balance
    FROM user_credits
    WHERE user_id = p_user_id;

    -- If user has no credit record, return failure
    IF v_current_balance IS NULL THEN
        RETURN QUERY SELECT false, 0::INTEGER, NULL::UUID;
        RETURN;
    END IF;

    -- Check if balance is sufficient
    IF v_current_balance < p_amount THEN
        RETURN QUERY SELECT false, v_current_balance, NULL::UUID;
        RETURN;
    END IF;

    -- Deduct credits
    UPDATE user_credits
    SET
        balance = balance - p_amount,
        total_consumed = total_consumed + p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING balance INTO v_new_balance;

    -- Record transaction
    INSERT INTO credit_transactions (user_id, type, amount, balance_after, description, metadata)
    VALUES (p_user_id, 'consume', -p_amount, v_new_balance, p_description, p_metadata)
    RETURNING id INTO v_transaction_id;

    RETURN QUERY SELECT true, v_new_balance, v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Function: add_credits
-- Description: Add credits to user balance
-- Parameters:
--   p_user_id: UUID - User ID
--   p_amount: INTEGER - Amount to add
--   p_description: TEXT - Transaction description
--   p_metadata: JSONB - Additional metadata
--   p_type: TEXT - Transaction type (default: 'recharge')
-- Returns: TABLE with new balance and transaction ID
-- ============================================
CREATE OR REPLACE FUNCTION add_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_description TEXT,
    p_metadata JSONB DEFAULT '{}',
    p_type TEXT DEFAULT 'recharge'
)
RETURNS TABLE(
    new_balance INTEGER,
    transaction_id UUID
) AS $$
DECLARE
    v_new_balance INTEGER;
    v_transaction_id UUID;
    v_is_recharge BOOLEAN;
BEGIN
    v_is_recharge := (p_type = 'recharge');

    -- Insert or update user credits
    INSERT INTO user_credits (user_id, balance, total_recharged)
    VALUES (p_user_id, p_amount, CASE WHEN v_is_recharge THEN p_amount ELSE 0 END)
    ON CONFLICT (user_id) DO UPDATE
    SET
        balance = user_credits.balance + p_amount,
        total_recharged = user_credits.total_recharged +
            CASE WHEN v_is_recharge THEN p_amount ELSE 0 END,
        updated_at = NOW()
    RETURNING balance INTO v_new_balance;

    -- Record transaction
    INSERT INTO credit_transactions (user_id, type, amount, balance_after, description, metadata)
    VALUES (p_user_id, p_type, p_amount, v_new_balance, p_description, p_metadata)
    RETURNING id INTO v_transaction_id;

    RETURN QUERY SELECT v_new_balance, v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Function: refund_credits
-- Description: Refund credits from a failed generation
-- Parameters:
--   p_transaction_id: UUID - Original transaction ID to refund
-- Returns: TABLE with success status and new balance
-- ============================================
CREATE OR REPLACE FUNCTION refund_credits(
    p_transaction_id UUID
)
RETURNS TABLE(
    success BOOLEAN,
    new_balance INTEGER
) AS $$
DECLARE
    v_user_id UUID;
    v_amount INTEGER;
    v_current_balance INTEGER;
    v_original_transaction_exists BOOLEAN;
BEGIN
    -- Check if original transaction exists and is a consume type
    SELECT EXISTS(
        SELECT 1 FROM credit_transactions
        WHERE id = p_transaction_id AND type = 'consume'
    ) INTO v_original_transaction_exists;

    IF NOT v_original_transaction_exists THEN
        RETURN QUERY SELECT false, NULL::INTEGER;
        RETURN;
    END IF;

    -- Get original transaction details
    SELECT user_id, ABS(amount) INTO v_user_id, v_amount
    FROM credit_transactions
    WHERE id = p_transaction_id AND type = 'consume';

    -- Refund credits
    UPDATE user_credits
    SET
        balance = balance + v_amount,
        total_consumed = total_consumed - v_amount,
        updated_at = NOW()
    WHERE user_id = v_user_id
    RETURNING balance INTO v_current_balance;

    -- Record refund transaction
    INSERT INTO credit_transactions (user_id, type, amount, balance_after, description)
    VALUES (v_user_id, 'refund', v_amount, v_current_balance, '生成失败退还');

    RETURN QUERY SELECT true, v_current_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Function: get_user_credits_info
-- Description: Get user credit information with statistics
-- Parameters:
--   p_user_id: UUID - User ID
-- Returns: User credit information
-- ============================================
CREATE OR REPLACE FUNCTION get_user_credits_info(p_user_id UUID)
RETURNS TABLE(
    balance INTEGER,
    total_recharged INTEGER,
    total_consumed INTEGER,
    transaction_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        uc.balance,
        uc.total_recharged,
        uc.total_consumed,
        (SELECT COUNT(*) FROM credit_transactions WHERE user_id = p_user_id)::BIGINT
    FROM user_credits uc
    WHERE uc.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Grant execute permissions to authenticated users
-- ============================================
GRANT EXECUTE ON FUNCTION deduct_credits TO authenticated;
GRANT EXECUTE ON FUNCTION add_credits TO authenticated;
GRANT EXECUTE ON FUNCTION refund_credits TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_credits_info TO authenticated;
