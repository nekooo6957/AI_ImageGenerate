# Nano Banana Pro - 用户系统与积分系统实施计划

## 一、需求概述

### 1.1 业务目标

用户希望建立一个完整的用户系统，实现以下功能：

1. **统一用户认证**：登录账号后，在主平台和灵感社区使用同一身份
2. **数据同步**：查看生图历史记录、项目管理内容
3. **积分管理**：显示当前积分余额，根据生图消耗自动扣除
4. **跨平台体验**：在灵感社区以自己的 ID 上传内容

### 1.2 技术背景

**现有架构分析：**
- 纯前端单文件应用，无后端服务器
- 用户认证：基于本地 SHA256 密码加密，数据存储在浏览器
- 数据存储：IndexedDB + localStorage（无法跨设备同步）
- 图像生成：直接调用 APIMart API

**APIMart API 成本：**
| 分辨率 | 成本 | 建议积分值 |
|--------|------|-----------|
| 1K | $0.05 | 5 积分 |
| 2K | $0.05 | 5 积分 |
| 4K | $0.10 | 10 积分 |

**汇率设定：1 积分 = $0.01 ≈ ¥0.07**

### 1.3 用户提出的方案

> 用户思路：根据充值情况，提供用户有限额的 API Key。例如用户充值 $10，就在 API Key 设置 $10 限额。

**方案评估：**

| 方面 | 可行性 | 说明 |
|------|--------|------|
| 技术实现 | ✅ 可行 | APIMart 支持 API Key 限额设置 |
| 数据安全 | ⚠️ 有风险 | API Key 暴露在前端，用户可能滥用 |
| 跨设备同步 | ❌ 不可行 | API Key 存储在本地浏览器 |
| 积分管理 | ⚠️ 复杂 | 需要手动在 APIMart 后台管理 |
| 用户体验 | ⚠️ 一般 | 需要用户自己输入和管理 API Key |

**结论：** 用户提出的方案可以作为临时方案，但不适合作为长期解决方案。

---

## 二、推荐技术方案

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                        前端应用                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  主平台 HTML │  │ 灵感社区 HTML │  │  用户中心    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTPS
┌─────────────────────────────────────────────────────────────┐
│                      Supabase BaaS                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 用户认证系统 │  │  PostgreSQL  │  │ Edge Functions│     │
│  │  (Auth)      │  │   Database   │  │  (API 代理)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    第三方 API 服务                           │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │ APIMart API  │  │ 支付接口（未来）│                       │
│  │ (图像生成)   │  │  (虎皮椒等)  │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 为什么选择 Supabase？

| 优势 | 说明 |
|------|------|
| **快速上线** | 无需自己搭建服务器，1-2天即可完成集成 |
| **免费额度** | 500MB 数据库 + 1GB 文件存储 + 50k MAU |
| **用户认证** | 开箱即用的用户系统（邮箱/密码、OAuth） |
| **数据安全** | Row Level Security (RLS) 保护数据安全 |
| **API 代理** | Edge Functions 可以代理 APIMart 调用，隐藏 API Key |
| **国内友好** | 支持国内访问，支付可接入虎皮椒/ PayJS |

### 2.3 核心功能实现

#### A. 用户认证系统

```javascript
// 使用 Supabase Auth
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// 注册
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'password123'
})

// 登录
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123'
})

// 获取当前用户
const { data: { user } } = await supabase.auth.getUser()
```

#### B. 积分系统设计

**数据库表结构：**

```sql
-- 用户积分表
CREATE TABLE user_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  balance INTEGER DEFAULT 0,           -- 当前积分余额
  total_recharged INTEGER DEFAULT 0,   -- 累计充值积分
  total_consumed INTEGER DEFAULT 0,    -- 累计消耗积分
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 积分交易记录
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  type TEXT NOT NULL,                  -- 'recharge' | 'consume' | 'refund'
  amount INTEGER NOT NULL,             -- 积分变化（正数=增加，负数=减少）
  balance_after INTEGER NOT NULL,      -- 交易后余额
  description TEXT,                    -- 描述
  metadata JSONB,                      -- 额外信息 {resolution, count, projectId}
  status TEXT DEFAULT 'completed',     -- 'completed' | 'failed' | 'pending'
  created_at TIMESTAMP DEFAULT NOW()
);

-- 生成日志
CREATE TABLE generation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  project_id TEXT,
  prompt TEXT,
  config JSONB,                        -- {ratio, resolution, n}
  cost INTEGER,                        -- 消耗积分
  apimart_task_id TEXT,
  status TEXT,                         -- 'pending' | 'succeeded' | 'failed'
  result_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### C. API 代理（隐藏 APIMart Key）

**Edge Function 代码：**

```typescript
// supabase/functions/generate-image/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const APIMART_KEY = Deno.env.get('APIMART_KEY') // 存储在服务端

serve(async (req) => {
  const { prompt, size, resolution, n } = await req.json()

  // 调用 APIMart API
  const response = await fetch('https://api.apimart.ai/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${APIMART_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gemini-3-pro-image-preview',
      prompt,
      size,
      n,
      resolution
    })
  })

  const data = await response.json()
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

**优势：**
- ✅ API Key 不暴露在前端
- ✅ 可以在服务端验证用户积分
- ✅ 可以统一管理所有用户的 API 调用
- ✅ 可以记录详细的使用日志

---

## 三、积分系统设计

### 3.1 定价策略

#### A. 积分与成本对应关系

| 生成类型 | APIMart 成本 | 消耗积分 | 用户成本（按汇率） |
|---------|-------------|---------|-------------------|
| 1K 单张 | $0.05 | 5 积分 | ¥0.36 |
| 2K 单张 | $0.05 | 5 积分 | ¥0.36 |
| 4K 单张 | $0.10 | 10 积分 | ¥0.72 |

**说明：**
- 1 积分 = $0.01（APIMart 成本）
- 汇率：1 美元 ≈ 7.2 人民币
- 平台不赚取差价（成本定价）

#### B. 充值套餐

| 充值金额 | 获得积分 | 汇率 | 备注 |
|---------|---------|------|------|
| ¥10 | 139 积分 | ¥0.072/积分 | 体验包 |
| ¥50 | 694 积分 | ¥0.072/积分 | 常用包 |
| ¥100 | 1389 积分 | ¥0.072/积分 | 充值包 |
| ¥500 | 6944 积分 | ¥0.072/积分 | 大容量包 |

**可生成图片数量（以 2K 为例）：**
- ¥10 → 139 积分 → 约 27 张
- ¥50 → 694 积分 → 约 138 张
- ¥100 → 1389 积分 → 约 277 张
- ¥500 → 6944 积分 → 约 1388 张

### 3.2 积分操作流程

```
┌─────────────────────────────────────────────────────────────┐
│                      积分系统流程                            │
└─────────────────────────────────────────────────────────────┘

【充值流程】
用户选择套餐 → 创建充值订单 → 跳转支付 → 支付回调 → 增加积分
                                                           ↓
                                                    记录交易历史

【生图流程】
用户点击生成 → 检查积分余额 → 扣除积分 → 调用 API → 生成完成
                      ↓                              ↓
                 积分不足提示                  失败则退还积分

【查询流程】
用户登录 → 读取积分余额 → 显示在界面 → 点击查看详情 → 交易历史
```

### 3.3 临时方案（不用支付系统）

如果暂时不想接入支付系统，可以采用以下方式：

#### 方案 1：管理员手动充值

```javascript
// 管理员在 Supabase Dashboard 直接操作
// 或者创建一个简单的管理界面
async function adminAddCredits(userId, amount, reason) {
  const { data, error } = await supabase
    .from('user_credits')
    .update({
      balance: supabase.raw(`balance + ${amount}`),
      total_recharged: supabase.raw(`total_recharged + ${amount}`)
    })
    .eq('user_id', userId)

  // 记录交易
  await supabase.from('credit_transactions').insert({
    user_id: userId,
    type: 'recharge',
    amount: amount,
    balance_after: newBalance,
    description: reason
  })
}
```

**使用场景：**
- 用户通过微信/支付宝转账给管理员
- 管理员手动为用户添加积分
- 适合内测阶段或小规模使用

#### 方案 2：邀请注册奖励

```javascript
// 新用户注册赠送积分
async function onUserSignUp(userId) {
  await supabase.from('user_credits').insert({
    user_id: userId,
    balance: 20,  // 新用户赠送 20 积分
    total_recharged: 20
  })
}

// 邀请好友奖励
async function onInviteSuccess(inviterId) {
  await supabase.rpc('add_credits', {
    user_id: inviterId,
    amount: 50  // 邀请成功奖励 50 积分
  })
}
```

---

## 四、数据库设计（Supabase PostgreSQL）

### 4.1 完整表结构

```sql
-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================
-- 用户积分表
-- ====================
CREATE TABLE user_credits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL UNIQUE,
  balance INTEGER DEFAULT 0 CHECK (balance >= 0),
  total_recharged INTEGER DEFAULT 0,
  total_consumed INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ====================
-- 积分交易记录
-- ====================
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('recharge', 'consume', 'refund', 'bonus')),
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'pending')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ====================
-- 生成日志
-- ====================
CREATE TABLE generation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  project_id TEXT,
  prompt TEXT NOT NULL,
  config JSONB NOT NULL,  -- {ratio, resolution, n, tags}
  cost INTEGER NOT NULL,
  apimart_task_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed')),
  result_urls TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- ====================
-- 项目管理
-- ====================
CREATE TABLE user_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ====================
-- 灵感社区内容
-- ====================
CREATE TABLE community_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  title TEXT,
  description TEXT,
  prompt TEXT,
  image_url TEXT NOT NULL,
  tags TEXT[],
  likes_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ====================
-- 索引
-- ====================
CREATE INDEX idx_transactions_user ON credit_transactions(user_id, created_at DESC);
CREATE INDEX idx_generations_user ON generation_logs(user_id, created_at DESC);
CREATE INDEX idx_projects_user ON user_projects(user_id, name);
CREATE INDEX idx_community_user ON community_posts(user_id, created_at DESC);
CREATE INDEX idx_community_tags ON community_posts USING GIN(tags);

-- ====================
-- 触发器：自动更新 updated_at
-- ====================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_credits_updated_at BEFORE UPDATE ON user_credits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_projects_updated_at BEFORE UPDATE ON user_projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ====================
-- Row Level Security (RLS)
-- ====================

-- 启用 RLS
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;

-- 用户只能访问自己的数据
CREATE POLICY "Users can view own credits" ON user_credits
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own transactions" ON credit_transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own generations" ON generation_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own projects" ON user_projects
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view community posts" ON community_posts
    FOR SELECT USING (true);

CREATE POLICY "Users can create own posts" ON community_posts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts" ON community_posts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts" ON community_posts
    FOR DELETE USING (auth.uid() = user_id);
```

### 4.2 数据库函数

```sql
-- ====================
-- 积分操作函数
-- ====================

-- 扣除积分
CREATE OR REPLACE FUNCTION deduct_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_description TEXT,
  p_metadata JSONB DEFAULT '{}'
) RETURNS TABLE(success BOOLEAN, new_balance INTEGER, transaction_id UUID) AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
  v_transaction_id UUID;
BEGIN
  -- 获取当前余额
  SELECT balance INTO v_current_balance
  FROM user_credits
  WHERE user_id = p_user_id;

  -- 检查余额是否足够
  IF v_current_balance < p_amount THEN
    RETURN QUERY SELECT false, v_current_balance, NULL::UUID;
    RETURN;
  END IF;

  -- 扣除积分
  UPDATE user_credits
  SET
    balance = balance - p_amount,
    total_consumed = total_consumed + p_amount
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;

  -- 记录交易
  INSERT INTO credit_transactions (user_id, type, amount, balance_after, description, metadata)
  VALUES (p_user_id, 'consume', -p_amount, v_new_balance, p_description, p_metadata)
  RETURNING id INTO v_transaction_id;

  RETURN QUERY SELECT true, v_new_balance, v_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- 增加积分
CREATE OR REPLACE FUNCTION add_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_description TEXT,
  p_metadata JSONB DEFAULT '{}',
  p_type TEXT DEFAULT 'recharge'
) RETURNS TABLE(new_balance INTEGER, transaction_id UUID) AS $$
DECLARE
  v_new_balance INTEGER;
  v_transaction_id UUID;
BEGIN
  -- 增加积分
  INSERT INTO user_credits (user_id, balance, total_recharged)
  VALUES (p_user_id, p_amount, p_amount)
  ON CONFLICT (user_id) DO UPDATE
  SET
    balance = user_credits.balance + p_amount,
    total_recharged = user_credits.total_recharged +
      CASE WHEN p_type = 'recharge' THEN p_amount ELSE 0 END
  RETURNING balance INTO v_new_balance;

  -- 记录交易
  INSERT INTO credit_transactions (user_id, type, amount, balance_after, description, metadata)
  VALUES (p_user_id, p_type, p_amount, v_new_balance, p_description, p_metadata)
  RETURNING id INTO v_transaction_id;

  RETURN QUERY SELECT v_new_balance, v_transaction_id;
END;
$$ LANGUAGE plpgsql;

-- 退还积分（生成失败时）
CREATE OR REPLACE FUNCTION refund_credits(
  p_transaction_id UUID
) RETURNS TABLE(success BOOLEAN, new_balance INTEGER) AS $$
DECLARE
  v_user_id UUID;
  v_amount INTEGER;
  v_current_balance INTEGER;
BEGIN
  -- 获取原交易记录
  SELECT user_id, ABS(amount) INTO v_user_id, v_amount
  FROM credit_transactions
  WHERE id = p_transaction_id AND type = 'consume';

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::INTEGER;
    RETURN;
  END IF;

  -- 增加积分
  UPDATE user_credits
  SET
    balance = balance + v_amount,
    total_consumed = total_consumed - v_amount
  WHERE user_id = v_user_id
  RETURNING balance INTO v_current_balance;

  -- 记录退款交易
  INSERT INTO credit_transactions (user_id, type, amount, balance_after, description)
  VALUES (v_user_id, 'refund', v_amount, v_current_balance, '生成失败退还');

  RETURN QUERY SELECT true, v_current_balance;
END;
$$ LANGUAGE plpgsql;
```

---

## 五、Edge Functions 实现

### 5.1 图像生成（带积分验证）

```typescript
// supabase/functions/generate-image/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const APIMART_KEY = Deno.env.get('APIMART_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// 积分消耗规则
const COST_RULES = {
  '1K': 5,
  '2K': 5,
  '4K': 10
}

serve(async (req) => {
  try {
    // 验证用户身份
    const authHeader = req.headers.get('Authorization')!
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    // 解析请求参数
    const { prompt, size, resolution, n = 1, project_id } = await req.json()

    // 计算消耗积分
    const cost = COST_RULES[resolution as keyof typeof COST_RULES] * n

    // 验证并扣除积分
    const { data: creditData, error: creditError } = await supabase
      .rpc('deduct_credits', {
        p_user_id: user.id,
        p_amount: cost,
        p_description: `生成 ${resolution} 图片 × ${n}张`,
        p_metadata: { resolution, count: n, project_id }
      })

    if (creditError || !creditData[0].success) {
      return new Response(
        JSON.stringify({
          error: 'Insufficient credits',
          required: cost,
          balance: creditData?.[0]?.new_balance || 0
        }),
        { status: 400 }
      )
    }

    const transactionId = creditData[0].transaction_id
    const newBalance = creditData[0].new_balance

    // 调用 APIMart API
    const apimartResponse = await fetch('https://api.apimart.ai/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${APIMART_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gemini-3-pro-image-preview',
        prompt,
        size,
        n,
        resolution,
        image_urls: []
      })
    })

    if (!apimartResponse.ok) {
      // API 调用失败，退还积分
      await supabase.rpc('refund_credits', { p_transaction_id: transactionId })
      return new Response(
        JSON.stringify({ error: 'API request failed', credits_refunded: cost }),
        { status: 500 }
      )
    }

    const apimartData = await apimartResponse.json()

    // 记录生成日志
    const { data: logData } = await supabase
      .from('generation_logs')
      .insert({
        user_id: user.id,
        project_id,
        prompt,
        config: { size, resolution, n },
        cost,
        apimart_task_id: apimartData.task_id,
        status: 'pending'
      })
      .select()
      .single()

    return new Response(JSON.stringify({
      task_id: apimartData.task_id,
      generation_id: logData.id,
      transaction_id: transactionId,
      new_balance: newBalance,
      cost: cost
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
```

### 5.2 查询任务状态（带自动退款）

```typescript
// supabase/functions/check-task/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const APIMART_KEY = Deno.env.get('APIMART_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  try {
    const { task_id, generation_id, transaction_id } = await req.json()

    // 调用 APIMart API 查询状态
    const response = await fetch(`https://api.apimart.ai/v1/tasks/${task_id}?language=zh`, {
      headers: { 'Authorization': `Bearer ${APIMART_KEY}` }
    })

    const data = await response.json()
    const status = data.task_status // 'succeeded' | 'failed' | 'processing'

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    if (status === 'succeeded') {
      // 更新生成日志
      await supabase
        .from('generation_logs')
        .update({
          status: 'succeeded',
          result_urls: data.result_urls,
          completed_at: new Date().toISOString()
        })
        .eq('id', generation_id)

      return new Response(JSON.stringify({
        status: 'succeeded',
        urls: data.result_urls
      }))
    } else if (status === 'failed') {
      // 生成失败，退还积分
      const { data: refundData } = await supabase
        .rpc('refund_credits', { p_transaction_id: transaction_id })

      // 更新生成日志
      await supabase
        .from('generation_logs')
        .update({ status: 'failed', completed_at: new Date().toISOString() })
        .eq('id', generation_id)

      return new Response(JSON.stringify({
        status: 'failed',
        error: data.error?.message || 'Generation failed',
        credits_refunded: refundData?.[0]?.success
      }))
    }

    return new Response(JSON.stringify({ status: 'processing' }))

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
```

### 5.3 获取用户积分信息

```typescript
// supabase/functions/get-user-credits/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization')!
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    // 获取积分余额
    const { data: credits } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // 获取最近交易记录
    const { data: transactions } = await supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    return new Response(JSON.stringify({
      credits: credits || { balance: 0, total_recharged: 0, total_consumed: 0 },
      transactions: transactions || []
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
```

---

## 六、前端集成方案

### 6.1 用户界面改造

#### A. 登录/注册界面

```html
<!-- 替换原有的本地认证为 Supabase Auth -->
<div id="authModal" class="fixed inset-0 z-[100] flex" style="display: none;">
  <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
  <div class="absolute inset-0 flex items-center justify-center p-4">
    <div class="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">
      <h2 class="text-2xl font-bold mb-6 text-center">登录 Nano Banana Pro</h2>

      <form id="authForm" class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-2">邮箱</label>
          <input type="email" id="authEmail" required
                 class="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500">
        </div>
        <div>
          <label class="block text-sm font-medium mb-2">密码</label>
          <input type="password" id="authPassword" required
                 class="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500">
        </div>
        <button type="submit" class="w-full bg-black text-white py-3 rounded-xl font-medium hover:bg-gray-800">
          登录
        </button>
      </form>

      <div class="mt-4 text-center">
        <span class="text-gray-600">还没有账号？</span>
        <button id="switchToSignUp" class="text-blue-600 font-medium">立即注册</button>
      </div>
    </div>
  </div>
</div>
```

#### B. 积分显示组件

```html
<!-- 在主界面顶部添加积分显示 -->
<div class="flex items-center gap-4 px-6 py-3 bg-gray-50 rounded-xl border border-gray-100">
  <div class="flex items-center gap-2">
    <i class="fas fa-coins text-yellow-500"></i>
    <span class="text-sm text-gray-600">积分余额</span>
  </div>
  <span id="creditsBalance" class="font-bold text-lg">--</span>
  <button onclick="openRechargeModal()" class="ml-auto text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
    充值
  </button>
</div>

<!-- 消耗提示 -->
<div id="costPreview" class="flex items-center justify-between px-4 py-2 bg-blue-50 rounded-lg text-sm">
  <span>生成配置：2K × 4张</span>
  <span>预计消耗：<strong class="text-blue-600">20 积分</strong> (约 ¥1.44)</span>
</div>
```

### 6.2 JavaScript 集成代码

```javascript
// ========== 引入 Supabase SDK ==========
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<script>
// ========== Supabase 配置 ==========
const SUPABASE_URL = 'YOUR_SUPABASE_URL'
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ========== 用户认证 ==========
async function handleSignUp() {
  const email = document.getElementById('authEmail').value
  const password = document.getElementById('authPassword').value

  const { data, error } = await supabase.auth.signUp({
    email,
    password
  })

  if (error) {
    alert('注册失败：' + error.message)
    return
  }

  // 创建用户积分记录
  await fetch('/functions/create-user-credits', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${data.session.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ user_id: data.user.id })
  })

  alert('注册成功！已赠送 20 积分')
  closeAuthModal()
  await loadUserData()
}

async function handleLogin() {
  const email = document.getElementById('authEmail').value
  const password = document.getElementById('authPassword').value

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })

  if (error) {
    alert('登录失败：' + error.message)
    return
  }

  closeAuthModal()
  await loadUserData()
}

async function handleLogout() {
  await supabase.auth.signOut()
  location.reload()
}

// ========== 加载用户数据 ==========
async function loadUserData() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // 显示用户信息
  document.getElementById('userEmail').textContent = user.email

  // 加载积分余额
  await loadUserCredits()

  // 加载项目列表
  await loadProjectsFromServer()

  // 加载生成历史
  await loadGenerationsFromServer()
}

// ========== 积分管理 ==========
async function loadUserCredits() {
  const { data, error } = await supabase
    .from('user_credits')
    .select('*')
    .single()

  if (data) {
    document.getElementById('creditsBalance').textContent = data.balance
  }
}

// ========== 修改生成流程 ==========
async function executeSynthesis() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    alert('请先登录')
    openAuthModal()
    return
  }

  const cost = calculateCost(platformState.res, platformState.n)

  // 调用 Edge Function 生成图片
  const { data, error } = await supabase.functions.invoke('generate-image', {
    body: {
      prompt: userPrompt,
      size: platformState.ratio,
      resolution: platformState.res,
      n: platformState.n,
      project_id: platformState.currentProject
    }
  })

  if (error) {
    if (error.message.includes('Insufficient credits')) {
      alert(`积分不足！需要 ${error.required} 积分，当前 ${error.balance} 积分`)
      openRechargeModal()
    } else {
      alert('生成失败：' + error.message)
    }
    return
  }

  // 轮询任务状态
  pollTaskStatus(data.task_id, data.generation_id, data.transaction_id)
}

function calculateCost(resolution, count) {
  const costs = { '1K': 5, '2K': 5, '4K': 10 }
  return costs[resolution] * count
}

async function pollTaskStatus(taskId, generationId, transactionId) {
  const timer = setInterval(async () => {
    const { data } = await supabase.functions.invoke('check-task', {
      body: { task_id: taskId, generation_id: generationId, transaction_id: transactionId }
    })

    if (data.status === 'succeeded') {
      clearInterval(timer)
      displayResults(data.urls)
      await loadUserCredits() // 刷新积分
    } else if (data.status === 'failed') {
      clearInterval(timer)
      alert('生成失败，积分已退还')
      await loadUserCredits() // 刷新积分
    }
  }, 3000)
}
</script>
```

### 6.3 灵感社区集成

```javascript
// ========== 灵感社区用户系统 ==========

// 检查登录状态
async function checkCommunityAuth() {
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // 已登录，显示用户信息
    document.getElementById('communityUserInfo').innerHTML = `
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
          ${user.email[0].toUpperCase()}
        </div>
        <div>
          <p class="font-medium">${user.email}</p>
          <p class="text-xs text-gray-500">点击上传作品</p>
        </div>
      </div>
    `
    document.getElementById('uploadBtn').disabled = false
  } else {
    // 未登录，显示登录按钮
    document.getElementById('communityUserInfo').innerHTML = `
      <button onclick="openAuthModal()" class="bg-black text-white px-6 py-2 rounded-xl">
        登录后上传作品
      </button>
    `
    document.getElementById('uploadBtn').disabled = true
  }
}

// 上传作品到社区
async function uploadToCommunity(imageData, prompt, tags) {
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    alert('请先登录')
    openAuthModal()
    return
  }

  // 上传图片到 Supabase Storage
  const fileName = `${user.id}/${Date.now()}.png`
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('community-images')
    .upload(fileName, decodeBase64Data(imageData), {
      contentType: 'image/png'
    })

  if (uploadError) {
    alert('图片上传失败：' + uploadError.message)
    return
  }

  // 获取公共 URL
  const { data: { publicUrl } } = supabase.storage
    .from('community-images')
    .getPublicUrl(fileName)

  // 保存到数据库
  const { error } = await supabase
    .from('community_posts')
    .insert({
      user_id: user.id,
      title: `我的作品 ${new Date().toLocaleDateString()}`,
      description: '',
      prompt: prompt,
      image_url: publicUrl,
      tags: tags
    })

  if (error) {
    alert('发布失败：' + error.message)
  } else {
    alert('发布成功！')
    loadCommunityPosts() // 刷新列表
  }
}

// 加载社区内容
async function loadCommunityPosts() {
  const { data: posts } = await supabase
    .from('community_posts')
    .select('*, user_credits(user_id)')
    .order('created_at', { ascending: false })
    .limit(50)

  renderCommunityPosts(posts)
}
```

---

## 七、实施步骤

### Phase 1: Supabase 后端搭建（第 1 周）

#### Day 1-2: 项目初始化
- [ ] 注册 Supabase 账号
- [ ] 创建新项目
- [ ] 获取 API 密钥（URL, anon key, service_role key）
- [ ] 安装 Supabase CLI（可选，用于本地开发）

#### Day 3-4: 数据库创建
- [ ] 在 Supabase SQL Editor 中执行数据库 schema
- [ ] 创建所有表（user_credits, credit_transactions, generation_logs 等）
- [ ] 设置 Row Level Security (RLS) 策略
- [ ] 创建数据库函数（deduct_credits, add_credits, refund_credits）
- [ ] 测试数据库操作

#### Day 5-7: Edge Functions 开发
- [ ] 创建 `generate-image` 函数
- [ ] 创建 `check-task` 函数
- [ ] 创建 `get-user-credits` 函数
- [ ] 在 Supabase Dashboard 设置环境变量（APIMART_KEY）
- [ ] 测试所有 Edge Functions

### Phase 2: 前端集成（第 2 周）

#### Day 1-2: 用户认证集成
- [ ] 引入 Supabase SDK
- [ ] 替换现有登录系统为 Supabase Auth
- [ ] 实现注册/登录/登出功能
- [ ] 测试会话持久化

#### Day 3-4: 积分系统 UI
- [ ] 添加积分显示组件
- [ ] 添加消耗预览组件
- [ ] 创建充值 Modal（先做手动充值功能）
- [ ] 创建交易历史页面

#### Day 5-7: API 调用改造
- [ ] 修改 `executeSynthesis()` 函数，调用 Edge Function
- [ ] 实现任务状态轮询（带自动退款）
- [ ] 测试完整生图流程
- [ ] 测试积分扣除和退还

### Phase 3: 项目管理与历史（第 3 周）

#### Day 1-3: 项目管理
- [ ] 修改项目列表，从 Supabase 加载
- [ ] 实现项目创建/删除/重命名
- [ ] 将项目数据保存到 user_projects 表

#### Day 4-5: 生成历史
- [ ] 修改历史记录加载逻辑
- [ ] 从 generation_logs 表加载历史
- [ ] 实现历史记录的分页和筛选

#### Day 6-7: 灵感社区集成
- [ ] 修改灵感社区，使用 Supabase Auth
- [ ] 实现用户上传功能
- [ ] 使用 Supabase Storage 存储图片
- [ ] 保存到 community_posts 表

### Phase 4: 测试与优化（第 4 周）

#### Day 1-3: 功能测试
- [ ] 端到端测试：注册→登录→充值→生图→查看历史
- [ ] 测试积分不足场景
- [ ] 测试生成失败退款
- [ ] 测试并发请求

#### Day 4-5: 性能优化
- [ ] 优化图片加载（懒加载、缩略图）
- [ ] 优化数据库查询（添加索引）
- [ ] 优化前端渲染（虚拟滚动）

#### Day 6-7: 上线准备
- [ ] 添加错误监控（Supabase Logs）
- [ ] 配置自定义域名
- [ ] 准备上线文档

---

## 八、成本估算

### 8.1 运营成本

| 项目 | 成本 | 说明 |
|------|------|------|
| Supabase 免费版 | ¥0/月 | 500MB 数据库 + 1GB 存储 + 50k MAU |
| APIMart API | 按成本 | 用户支付多少，就用多少 |
| 域名 | ¥50-100/年 | 可选 |

### 8.2 Supabase 免费额度分析

**免费版限制：**
- 500MB 数据库存储
- 1GB 文件存储
- 50k 月活跃用户 (MAU)
- 500k Edge Functions 调用/月

**预估：**
- 假设 1000 个活跃用户
- 每用户每天生成 5 张图片
- 每月 API 调用：1000 × 5 × 30 = 150k 次
- **结论：** 免费版足够支撑初期运营

### 8.3 升级方案（超出免费额度）

**Supabase Pro 版：** $25/月
- 8GB 数据库存储
- 100GB 文件存储
- 100k MAU
- 500k Edge Functions 调用/月

---

## 九、风险与对策

### 9.1 技术风险

| 风险 | 对策 |
|------|------|
| APIMart API 不稳定 | 实现重试机制 + 备用 API |
| 数据库达到上限 | 定期清理旧数据，升级套餐 |
| Edge Functions 超时 | 优化代码，使用异步任务 |
| 图片存储空间不足 | 使用 CDN + 对象存储 |

### 9.2 业务风险

| 风险 | 对策 |
|------|------|
| 用户滥用 API | 添加请求频率限制 |
| 积分被盗用 | 加强会话管理，异常检测 |
| 支付纠纷 | 详细记录所有交易日志 |
| 成本超支 | 监控 API 调用量，设置预算告警 |

---

## 十、临时方案（不使用支付系统）

如果你暂时不想接入支付系统，可以采用以下方式：

### 方案 A：管理员手动充值

**流程：**
1. 用户通过微信/支付宝转账给管理员
2. 用户在平台提交充值申请（填写金额、转账凭证）
3. 管理员在 Supabase Dashboard 手动增加用户积分
4. 用户刷新页面看到积分增加

**实现：**
```javascript
// 用户提交充值申请
async function submitRechargeRequest(amount, proof) {
  await supabase.from('recharge_requests').insert({
    user_id: user.id,
    amount: amount,
    proof_image: proof,
    status: 'pending'
  })

  alert('充值申请已提交，请等待管理员审核')
}

// 管理员审核（仅在管理后台）
async function approveRecharge(requestId) {
  const request = await supabase.from('recharge_requests').select('*').eq('id', requestId).single()

  // 计算积分（1元 ≈ 13.9积分）
  const credits = Math.floor(request.amount * 13.9)

  await supabase.rpc('add_credits', {
    p_user_id: request.user_id,
    p_amount: credits,
    p_description: `充值 ¥${request.amount}`,
    p_type: 'recharge'
  })

  await supabase.from('recharge_requests').update({ status: 'approved' }).eq('id', requestId)
}
```

### 方案 B：邀请奖励机制

```javascript
// 新用户注册奖励
async function onUserSignUp(userId) {
  await supabase.from('user_credits').insert({
    user_id: userId,
    balance: 20,  // 赠送 20 积分（可生成 4 张 2K 图片）
    total_recharged: 20
  })
}

// 邀请好友奖励
async function inviteFriend(inviteCode) {
  // 生成邀请码时记录邀请关系
  await supabase.from('invitations').insert({
    inviter_id: currentUser.id,
    invite_code: inviteCode
  })
}

// 好友注册后，邀请者获得奖励
async function onInvitedUserSignUp(userId, inviteCode) {
  const { data: invitation } = await supabase
    .from('invitations')
    .select('*')
    .eq('invite_code', inviteCode)
    .single()

  if (invitation) {
    await supabase.rpc('add_credits', {
      p_user_id: invitation.inviter_id,
      p_amount: 50,
      p_description: '邀请好友奖励',
      p_type: 'bonus'
    })
  }
}
```

### 方案 C：每日签到奖励

```javascript
// 每日签到
async function dailyCheckIn() {
  const today = new Date().toISOString().split('T')[0]
  const userId = user.id

  // 检查今天是否已签到
  const { data: existing } = await supabase
    .from('check_in_records')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .single()

  if (existing) {
    alert('今天已经签到过了！')
    return
  }

  // 签到并赠送积分
  await supabase.from('check_in_records').insert({
    user_id: userId,
    date: today
  })

  await supabase.rpc('add_credits', {
    p_user_id: userId,
    p_amount: 5,
    p_description: '每日签到奖励',
    p_type: 'bonus'
  })

  alert('签到成功！获得 5 积分')
  await loadUserCredits()
}
```

---

## 十一、总结与建议

### 推荐实施路径

```
🚀 立即开始（第 1-2 周）
1. 注册 Supabase 账号
2. 创建数据库表
3. 开发 Edge Functions（generate-image, check-task）
4. 前端集成 Supabase Auth

📈 基础功能（第 3-4 周）
5. 实现积分系统 UI
6. 修改生图流程，加入积分验证
7. 测试完整流程

💡 增值功能（第 5-6 周）
8. 灵感社区用户系统
9. 项目管理云端同步
10. 临时充值方案（手动充值/邀请奖励）

💳 支付系统（未来）
11. 申请虎皮椒/ PayJS 账号
12. 集成支付接口
13. 上线发布
```

### 关键文件清单

| 文件 | 说明 | 优先级 |
|------|------|--------|
| `supabase/migrations/001_initial_schema.sql` | 数据库表结构 | P0 |
| `supabase/functions/generate-image/index.ts` | 图像生成 | P0 |
| `supabase/functions/check-task/index.ts` | 任务轮询 | P0 |
| `supabase/functions/get-user-credits/index.ts` | 积分查询 | P1 |
| `nanobananapro生图平台.html` | 主应用（需改造） | P0 |
| `inspiration_community.html` | 灵感社区（需改造） | P1 |

### 核心优势

✅ **无需服务器** - 使用 Supabase BaaS，零运维
✅ **数据安全** - RLS 保护，API Key 不暴露
✅ **快速上线** - 2-3 周即可完成核心功能
✅ **成本可控** - 免费版足够支撑初期运营
✅ **可扩展** - 未来可轻松添加支付、分析等功能

---

**文档版本：** v1.0
**创建日期：** 2025-01-08
**作者：** Claude Code
**预计开发周期：** 4-6 周
