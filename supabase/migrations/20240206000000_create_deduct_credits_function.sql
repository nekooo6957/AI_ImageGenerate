-- 创建积分扣除事务函数
CREATE OR REPLACE FUNCTION deduct_credits_transaction(
  user_id UUID,
  amount INTEGER,
  description TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}'
)
RETURNS TABLE (
  new_balance INTEGER,
  transaction_id UUID
)
LANGUAGE plpgsql
AS $$
DECLARE
  current_balance INTEGER;
  new_balance_val INTEGER;
  tx_id UUID;
BEGIN
  -- 获取当前积分（加锁）
  SELECT credits INTO current_balance
  FROM profiles
  WHERE id = user_id
  FOR UPDATE;

  -- 检查积分是否足够
  IF current_balance < amount THEN
    RAISE EXCEPTION 'Insufficient credits';
  END IF;

  -- 计算新余额
  new_balance_val := current_balance - amount;

  -- 更新用户积分
  UPDATE profiles
  SET
    credits = new_balance_val,
    total_consumed = total_consumed + amount,
    updated_at = NOW()
  WHERE id = user_id;

  -- 记录交易
  INSERT INTO transactions (user_id, type, amount, balance_after, description, metadata)
  VALUES (user_id, 'consume', amount, new_balance_val, description, metadata)
  RETURNING id INTO tx_id;

  -- 返回结果
  RETURN QUERY SELECT new_balance_val, tx_id;
END;
$$;
