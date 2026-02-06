# Nano Banana Pro - 积分系统实施计划

## 一、需求概述

### 1.1 业务目标
- 用户向平台充值积分
- 生成图片时自动扣除积分
- 显示当前余额和消费记录
- **积分定价包含利润**（1K/2K 利润 ¥0.04，4K 利润 ¥0.08）
- **API 密钥统一管理**（Supabase Edge Functions 存储，不暴露给前端）

### 1.2 积分与成本对应关系

**汇率：** 1 USD ≈ 7.2 CNY

| 生成类型 | APIMart 成本 | 用户支付 | 单张利润 | 消耗积分 | 积分价值 |
|---------|-------------|---------|---------|---------|---------|
| 1K 图片 | $0.05 ≈ ¥0.36 | ¥0.40 | ¥0.04 | 5 积分 | 1 积分 = ¥0.08 |
| 2K 图片 | $0.05 ≈ ¥0.36 | ¥0.40 | ¥0.04 | 5 积分 | 同上 |
| 4K 图片 | $0.10 ≈ ¥0.72 | ¥0.80 | ¥0.08 | 10 积分 | 同上 |

### 1.3 为什么不直接分发 API Key？

| 方式 | 优势 | 劣势 |
|-----|------|------|
| **直接分发 API Key** | 实现简单 | ❌ 密钥泄露风险<br>❌ 无法追踪用户行为<br>❌ 失去定价控制权<br>❌ 用户可能分享滥用 |
| **积分系统 + 统一后端** | ✅ API 密钥保密<br>✅ 完全控制定价<br>✅ 可追溯消费记录<br>✅ 灵活调整策略 | 需要搭建后端 |

**推荐方案：** 积分系统 + Supabase 后端 + 统一调用 APIMart API

### 1.4 当前架构分析
**现状：**
- 纯前端单文件应用（无后端）
- 用户自己提供 APIMart API Key
- 数据仅存储在本地（IndexedDB + localStorage）
- 无真正的用户验证

**改造后：**
- 后端验证积分扣除（Supabase Edge Functions）
- 平台统一管理 APIMart API Key
- 用户通过积分系统消费

**核心问题：**
- 积分系统必须有服务端验证，否则用户可修改本地数据

---

## 二、定价策略

### 2.1 积分价值设定

**1 积分 = ¥0.08**

### 2.2 生成消耗与利润

| 生成类型 | APIMart 成本 | 消耗积分 | 用户支付 | 单张利润 | 利润率 |
|---------|-------------|---------|---------|---------|--------|
| 1K 单张 | ¥0.36 | 5 积分 | ¥0.40 | ¥0.04 | 11% |
| 2K 单张 | ¥0.36 | 5 积分 | ¥0.40 | ¥0.04 | 11% |
| 4K 单张 | ¥0.72 | 10 积分 | ¥0.80 | ¥0.08 | 11% |
| 批量 N 张 | 基础 × N | - | - | 基础利润 × N | 11% |

**示例：**
- 生成 4 张 1K 图片 = 5 × 4 = 20 积分 = ¥1.60（成本 ¥1.44，利润 ¥0.16）
- 生成 2 张 4K 图片 = 10 × 2 = 20 积分 = ¥1.60（成本 ¥1.44，利润 ¥0.16）

### 2.3 充值套餐设计（含赠送 + 支付手续费预留）

| 充值金额 | 获得积分 | 赠送积分 | 实际价值 | 优惠力度 | 平台收益 |
|---------|---------|---------|---------|---------|---------|
| **体验包** | ¥6 | 50 积分 | - | ¥4.00 | 无 | ¥~1.5 |
| **基础包** | ¥25 | 300 积分 | - | ¥24.00 | 无 | ¥~0.5 |
| **标准包** | ¥50 | 625 积分 | 50 | ¥50.00 | 无 | ¥~0 |
| **专业包** | ¥100 | 1300 积分 | 150 | ¥104.00 | 4% | ¥~2 |
| **旗舰包** | ¥500 | 7000 积分 | 1000 | ¥560.00 | 12% | ¥~30 |

**说明：**
- 支付通道手续费约 2-3%（虎皮椒）
- 大额套餐赠送积分更多，鼓励批量充值
- 平台收益 = 售价 - (赠送积分 × 0.08) - 通道费

### 2.4 收益测算

假设月活 100 人，平均每人每月生成 50 张图（1K/2K）：

| 指标 | 数值 |
|------|------|
| 月生成量 | 5,000 张 |
| APIMart 成本 | ¥1,800（5,000 × ¥0.36） |
| 用户支付 | ¥2,000（5,000 × ¥0.40） |
| **月利润** | **¥200** |

假设月活 1,000 人：
| 指标 | 数值 |
|------|------|
| 月生成量 | 50,000 张 |
| APIMart 成本 | ¥18,000 |
| 用户支付 | ¥20,000 |
| **月利润** | **¥2,000** |

---

## 三、架构方案

### 推荐方案：Supabase BaaS（LeanCloud 替代）

**原因：** LeanCloud 已停止新用户注册

```
前端: 保持现有 HTML
后端: Supabase（免费额度）
支付: 虎皮椒 / PayJS（个人友好）
数据库: Supabase PostgreSQL
```

**Supabase 优势：**
- 开源 BaaS，功能类似 LeanCloud
- 免费额度：500MB 数据库 + 1GB 存储 + 每月 50 万次 API 调用
- 支持 Edge Functions（存放 API Key 安全）
- 内置 PostgreSQL（比 NoSQL 更适合交易记录）
- 支持 Row Level Security（行级安全）
- 国内可访问（虽稍慢于国内服务）

**免费额度详情：**
- 数据库：500MB
- 文件存储：1GB
- 带宽：2GB/月
- API 调用：50 万次/月
- Edge Functions：500k invocations/月

---

## 四、数据库设计

### 4.1 Supabase PostgreSQL 数据表

```sql
-- 用户表（使用 Supabase Auth 扩展）
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  credits INTEGER DEFAULT 0,
  total_recharged DECIMAL(10,2) DEFAULT 0,
  total_consumed INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 交易记录表
CREATE TABLE public.transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('recharge', 'consume', 'refund')),
  amount INTEGER NOT NULL, -- 积分变化（正数=增加，负数=减少）
  balance_after INTEGER NOT NULL,
  description TEXT,
  metadata JSONB,
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'pending')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 充值订单表
CREATE TABLE public.recharge_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  amount DECIMAL(10,2) NOT NULL, -- 充值金额（元）
  credits INTEGER NOT NULL, -- 获得积分
  method TEXT CHECK (method IN ('wechat', 'alipay')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
  transaction_id TEXT, -- 第三方交易ID
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

-- 生成日志表
CREATE TABLE public.generation_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  project_id TEXT,
  prompt TEXT,
  config JSONB, -- { ratio, resolution, n }
  cost INTEGER NOT NULL, -- 消耗积分
  apimart_task_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_created_at ON public.transactions(created_at DESC);
CREATE INDEX idx_recharge_orders_user_id ON public.recharge_orders(user_id);
CREATE INDEX idx_generation_logs_user_id ON public.generation_logs(user_id);

-- Row Level Security 策略
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recharge_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_logs ENABLE ROW LEVEL SECURITY;

-- 用户只能访问自己的数据
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own orders" ON public.recharge_orders
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own logs" ON public.generation_logs
  FOR SELECT USING (auth.uid() = user_id);
```

---

## 五、API 接口设计

### 5.1 用户相关

```
POST /auth/v1/signup
请求: { email, password, username }
响应: { user, session }

POST /auth/v1/token?grant_type=password
请求: { email, password }
响应: { access_token, user }

GET  /rest/v1/profiles?id=eq.{userId}
响应: [{ username, credits, total_recharged, total_consumed }]

GET  /rest/v1/transactions?user_id=eq.{userId}&limit=20&order=created_at.desc
响应: [{ type, amount, description, created_at }]
```

### 5.2 积分操作（Edge Functions）

```
POST /functions/v1/deduct-credits
请求: { cost, description, metadata }
响应: { success, balance, transactionId }

POST /functions/v1/refund-credits
请求: { transactionId, reason }
响应: { success, balance }

GET  /rest/v1/profiles?select=credits&id=eq.{userId}
响应: [{ credits }]
```

### 5.3 充值相关（Edge Functions）

```
GET  /functions/v1/recharge-packages
响应: [{ amount, credits, badge }]

POST /functions/v1/create-recharge
请求: { amount, credits, method }
响应: { orderId, paymentUrl, qrCode }

POST /functions/v1/payment-callback
请求: { transactionId, status, sign }
响应: { success, credits }
```

---

## 六、Supabase Edge Functions

Edge Functions 使用 Deno + TypeScript/JavaScript 编写。

### 6.1 项目初始化

```bash
# 安装 Supabase CLI
npm install -g supabase

# 初始化项目
supabase init

# 链接到远程项目
supabase link --project-ref your-project-ref

# 启动本地开发
supabase start
```

### 6.2 环境变量配置

```bash
# supabase/functions/_shared/config.ts
export const config = {
  apimartApiKey: Deno.env.get('APIMART_API_KEY'),
  huxiaoAppId: Deno.env.get('HUXIAO_APP_ID'),
  huxiaoAppSecret: Deno.env.get('HUXIAO_APP_SECRET'),
};
```

### 6.3 扣除积分

```typescript
// supabase/functions/deduct-credits/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const { cost, description, metadata } = await req.json();

    // 获取用户信息（从 JWT token）
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // 获取用户当前积分
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) throw new Error('User not found');

    const balance = profile.credits;

    // 检查余额
    if (balance < cost) {
      throw new Error(`积分不足！需要 ${cost}，当前 ${balance}`);
    }

    // 扣除积分
    const newBalance = balance - cost;
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        credits: newBalance,
        total_consumed: profile.total_consumed + cost,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) throw updateError;

    // 记录交易
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        type: 'consume',
        amount: -cost,
        balance_after: newBalance,
        description,
        metadata,
        status: 'completed'
      })
      .select()
      .single();

    if (txError) throw txError;

    return new Response(
      JSON.stringify({
        success: true,
        balance: newBalance,
        transactionId: transaction.id
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
```

### 6.4 退还积分

```typescript
// supabase/functions/refund-credits/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const { transactionId } = await req.json();

    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!  // 使用 service role key
    );

    // 获取原交易记录
    const { data: transaction, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (txError || !transaction || transaction.type !== 'consume') {
      throw new Error('无效的交易ID');
    }

    const refundAmount = Math.abs(transaction.amount);

    // 退还积分
    const { data: profile, error: updateError } = await supabase
      .from('profiles')
      .update({
        credits: supabase.raw(`credits + ${refundAmount}`),
        total_consumed: supabase.raw(`total_consumed - ${refundAmount}`),
        updated_at: new Date().toISOString()
      })
      .select('credits')
      .eq('id', transaction.user_id)
      .single();

    if (updateError) throw updateError;

    // 记录退款交易
    await supabase.from('transactions').insert({
      user_id: transaction.user_id,
      type: 'refund',
      amount: refundAmount,
      balance_after: profile.credits + refundAmount,
      description: '生成失败退还',
      status: 'completed'
    });

    return new Response(
      JSON.stringify({
        success: true,
        balance: profile.credits + refundAmount
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
```

### 6.5 创建充值订单

```typescript
// supabase/functions/create-recharge/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const { amount, credits, method } = await req.json();

    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // 创建充值订单
    const { data: order, error: orderError } = await supabase
      .from('recharge_orders')
      .insert({
        user_id: user.id,
        amount,
        credits,
        method,
        status: 'pending'
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // 调用虎皮椒支付接口
    const payment = await createHuxiaoPayment({
      orderId: order.id,
      amount: amount.toString(),
      title: `充值 ${credits} 积分`
    });

    return new Response(
      JSON.stringify({
        orderId: order.id,
        paymentUrl: payment.url,
        qrCode: payment.qrCode
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

// 虎皮椒支付接口
async function createHuxiaoPayment(params: any) {
  const huxiaoConfig = {
    appId: Deno.env.get('HUXIAO_APP_ID'),
    appSecret: Deno.env.get('HUXIAO_APP_SECRET'),
    apiUrl: 'https://api.xunhupay.com'
  };

  const paymentParams = {
    appid: huxiaoConfig.appId,
    trade_order_id: params.orderId,
    total_fee: params.amount,
    title: params.title,
    time: Math.floor(Date.now() / 1000),
    notify_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-callback`,
    nonce_str: Math.random().toString(36).substr(2)
  };

  // 生成签名
  const sign = generateSignature(paymentParams, huxiaoConfig.appSecret);
  paymentParams.sign = sign;

  const response = await fetch(`${huxiaoConfig.apiUrl}/payment/do.html`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(paymentParams)
  });

  return await response.json();
}

function generateSignature(params: any, secret: string): string {
  const sorted = Object.keys(params).sort()
    .filter(k => k !== 'sign')
    .map(k => `${k}=${params[k]}`)
    .join('&');

  // 需要引入 md5 库
  return md5(sorted + secret).toUpperCase();
}
```

### 6.6 支付回调处理

```typescript
// supabase/functions/payment-callback/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const params = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. 验证签名
    const expectedSign = generateSignature(params, Deno.env.get('HUXIAO_APP_SECRET')!);
    if (expectedSign !== params.sign) {
      throw new Error('签名验证失败');
    }

    // 2. 查找订单
    const { data: order, error: orderError } = await supabase
      .from('recharge_orders')
      .select('*')
      .eq('id', params.trade_order_id)
      .single();

    if (orderError || !order) {
      throw new Error('订单不存在');
    }

    // 避免重复处理
    if (order.status === 'paid') {
      return new Response(JSON.stringify({ code: 0, msg: 'OK' }));
    }

    // 3. 更新订单
    const { error: updateError } = await supabase
      .from('recharge_orders')
      .update({
        status: 'paid',
        transaction_id: params.transaction_id,
        paid_at: new Date().toISOString()
      })
      .eq('id', order.id);

    if (updateError) throw updateError;

    // 4. 增加用户积分
    const { data: profile } = await supabase
      .from('profiles')
      .update({
        credits: supabase.raw(`credits + ${order.credits}`),
        total_recharged: supabase.raw(`total_recharged + ${order.amount}`),
        updated_at: new Date().toISOString()
      })
      .select('credits')
      .eq('id', order.user_id)
      .single();

    // 5. 记录交易
    await supabase.from('transactions').insert({
      user_id: order.user_id,
      type: 'recharge',
      amount: order.credits,
      balance_after: profile.credits + order.credits,
      description: `充值 ¥${order.amount}`,
      status: 'completed'
    });

    return new Response(JSON.stringify({ code: 0, msg: 'OK' }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
```

---

## 七、前端改动

### 7.1 引入 Supabase SDK

```html
<!-- 在 <head> 中添加 -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

### 7.2 UI 新增组件

**积分显示区域（用户信息旁）**
```html
<div id="creditsDisplay" class="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-xl border border-gray-200">
    <div class="flex items-center gap-2">
        <i class="fas fa-coins text-yellow-500"></i>
        <span class="text-xs text-gray-600">积分余额</span>
    </div>
    <span id="creditsBalance" class="font-bold text-lg">--</span>
    <button onclick="openRechargeModal()" class="ml-2 px-3 py-1.5 bg-black text-white rounded-lg text-xs hover:bg-gray-800 transition-colors">
        <i class="fas fa-plus mr-1"></i>充值
    </button>
</div>
```

**消耗提示（生成按钮上方）**
```html
<div id="costPreview" class="flex items-center justify-between px-4 py-2 bg-blue-50 rounded-lg text-xs text-blue-700">
    <span>生成配置：2K × 4张</span>
    <span>预计消耗：<strong>20 积分</strong> (¥1.60)</span>
</div>
```

**充值 Modal**
```html
<div id="rechargeModal" class="fixed inset-0 z-[100]" style="display: none;">
    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" onclick="closeRechargeModal()"></div>
    <div class="absolute inset-0 flex items-center justify-center p-4">
        <div class="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <!-- 头部 -->
            <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                <h2 class="text-lg font-bold">积分充值</h2>
                <button onclick="closeRechargeModal()" class="text-gray-400 hover:text-black">
                    <i class="fas fa-times"></i>
                </button>
            </div>

            <!-- 套餐选择 -->
            <div class="p-6 space-y-3" id="rechargePackages">
                <!-- 套餐卡片由 JS 动态生成 -->
            </div>

            <!-- 支付方式 -->
            <div class="px-6 pb-6">
                <p class="text-sm text-gray-600 mb-3">支付方式</p>
                <div class="flex gap-3">
                    <button class="flex-1 py-3 border-2 border-green-500 rounded-xl flex items-center justify-center gap-2">
                        <i class="fab fa-weixin text-green-500"></i>
                        <span>微信支付</span>
                    </button>
                    <button class="flex-1 py-3 border-2 border-blue-500 rounded-xl flex items-center justify-center gap-2">
                        <i class="fab fa-alipay text-blue-500"></i>
                        <span>支付宝</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>
```

### 7.3 JavaScript 新增代码

```javascript
// ========== Supabase 配置 ==========
const SUPABASE_CONFIG = {
  url: 'https://your-project.supabase.co',
  anonKey: 'your-anon-key'
};

const supabase = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

// ========== 积分系统状态 ==========
const creditsState = {
    balance: 0,
    transactions: [],
    isLoading: false
};

// 充值套餐（新定价：1 积分 = ¥0.08）
const RECHARGE_PACKAGES = [
    { amount: 6, credits: 50, badge: '体验包' },
    { amount: 25, credits: 300, badge: '基础包' },
    { amount: 50, credits: 625, badge: '标准包', bonus: 50, hot: true },
    { amount: 100, credits: 1300, badge: '专业包', bonus: 150, best: true },
    { amount: 500, credits: 7000, badge: '旗舰包', bonus: 1000 }
];

// ========== 积分消耗计算 ==========
function calculateCost(resolution, count) {
    const baseCost = { '1K': 5, '2K': 5, '4K': 10 };
    return baseCost[resolution] * count;
}

// ========== 获取用户信息 ==========
async function fetchUserInfo() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
            .from('profiles')
            .select('credits')
            .eq('id', user.id)
            .single();

        if (error) throw error;
        creditsState.balance = data.credits;
        updateCreditsDisplay();
    } catch (error) {
        console.error('获取用户信息失败:', error);
    }
}

// ========== 更新积分显示 ==========
function updateCreditsDisplay() {
    document.getElementById('creditsBalance').textContent = creditsState.balance;
    updateCostPreview();
}

// ========== 更新消耗预览 ==========
function updateCostPreview() {
    const cost = calculateCost(platformState.res, platformState.n);
    const yuanCost = (cost * 0.08).toFixed(2);
    document.getElementById('costPreview').innerHTML =
        `生成配置：${platformState.res} × ${platformState.n}张 | 预计消耗：<strong>${cost} 积分</strong> (¥${yuanCost})`;
}

// ========== 检查余额 ==========
async function checkBalance() {
    const cost = calculateCost(platformState.res, platformState.n);
    if (creditsState.balance < cost) {
        alert(`积分不足！需要 ${cost} 积分，当前余额 ${creditsState.balance}`);
        openRechargeModal();
        return false;
    }
    return true;
}

// ========== 扣除积分 ==========
async function deductCredits(cost, description, metadata) {
    try {
        const { data, error } = await supabase.functions.invoke('deduct-credits', {
            body: { cost, description, metadata }
        });

        if (error) throw error;

        creditsState.balance = data.balance;
        updateCreditsDisplay();
        return data;
    } catch (error) {
        console.error('扣除积分失败:', error);
        alert('扣除积分失败: ' + error.message);
        return null;
    }
}

// ========== 退还积分 ==========
async function refundCredits(transactionId) {
    try {
        const { data, error } = await supabase.functions.invoke('refund-credits', {
            body: { transactionId }
        });

        if (error) throw error;
        creditsState.balance = data.balance;
        updateCreditsDisplay();
    } catch (error) {
        console.error('退还积分失败:', error);
    }
}

// ========== 渲染充值套餐 ==========
function renderRechargePackages() {
    const container = document.getElementById('rechargePackages');
    container.innerHTML = RECHARGE_PACKAGES.map(pkg => `
        <div onclick="selectPackage(${pkg.amount}, ${pkg.credits})"
             class="relative p-4 border-2 rounded-xl cursor-pointer hover:border-black transition-all ${pkg.hot ? 'border-orange-500 bg-orange-50' : 'border-gray-200'}">
            ${pkg.best ? '<div class="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">推荐</div>' : ''}
            ${pkg.hot ? '<div class="absolute -top-2 -right-2 bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">热门</div>' : ''}
            ${pkg.bonus ? `<div class="absolute -top-2 -left-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">赠送${pkg.bonus}</div>` : ''}
            <div class="flex justify-between items-center">
                <div>
                    <p class="text-xs text-gray-500">${pkg.badge}</p>
                    <p class="text-xl font-bold">¥${pkg.amount}</p>
                </div>
                <div class="text-right">
                    <p class="text-xs text-gray-500">获得</p>
                    <p class="text-lg font-bold text-blue-600">${pkg.credits} 积分</p>
                </div>
            </div>
        </div>
    `).join('');
}

// ========== 选择充值套餐 ==========
async function selectPackage(amount, credits) {
    const confirmed = confirm(`确认充值 ¥${amount} 获得 ${credits} 积分？`);
    if (!confirmed) return;

    try {
        const { data, error } = await supabase.functions.invoke('create-recharge', {
            body: { amount, credits, method: 'wechat' }
        });

        if (error) throw error;

        // 显示支付二维码
        showPaymentQR(data.qrCode);

    } catch (error) {
        console.error('创建充值订单失败:', error);
        alert('创建订单失败: ' + error.message);
    }
}
```

### 7.4 修改生成流程

```javascript
// 修改 executeSynthesis 函数
async function executeSynthesis() {
    // 1. 检查积分（新增）
    const cost = calculateCost(platformState.res, platformState.n);
    if (!await checkBalance()) return;

    // 2. 扣除积分（新增）
    const deduction = await deductCredits(cost, `生成 ${platformState.res} 图片`, {
        resolution: platformState.res,
        count: platformState.n,
        projectId: platformState.currentProject
    });

    if (!deduction) {
        alert('扣除积分失败');
        return;
    }

    try {
        // 3. 调用 APIMart API（原有逻辑，但现在使用 Edge Function 代理）
        const { data, error } = await supabase.functions.invoke('generate-image', {
            body: {
                prompt: prompt,
                size: platformState.ratio,
                n: platformState.n,
                resolution: platformState.res,
                image_urls: [...]
            }
        });

        if (error) throw error;

        // 4. 轮询任务状态（原有逻辑）
        monitorTask(data.task_id, deduction.transactionId);

    } catch (error) {
        console.error('生成失败:', error);

        // 5. 生成失败，退还积分（新增）
        await refundCredits(deduction.transactionId);
        alert('生成失败，积分已退还');
    }
}

// 修改 monitorTask 函数，添加 transactionId 参数
async function monitorTask(tid, transactionId) {
    // ... 原有轮询逻辑 ...

    if (status === 'succeeded') {
        // 生成成功，不做处理
    } else if (status === 'failed') {
        // 生成失败，退还积分（新增）
        await refundCredits(transactionId);
        alert('生成失败，积分已退还');
    }
}
```

### 7.5 新增：图片生成 Edge Function（隐藏 API Key）

```typescript
// supabase/functions/generate-image/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  try {
    const { prompt, size, n, resolution, image_urls } = await req.json();

    const apimartKey = Deno.env.get('APIMART_API_KEY')!;

    const response = await fetch('https://api.apimart.ai/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apimartKey}`
      },
      body: JSON.stringify({
        model: "gemini-3-pro-image-preview",
        prompt,
        size,
        n,
        resolution,
        image_urls
      })
    });

    const data = await response.json();

    return new Response(
      JSON.stringify(data),
      { headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
```

---

## 八、支付集成（虎皮椒）

### 8.1 虎皮椒配置

环境变量（在 Supabase Dashboard → Edge Functions → Settings）：

```bash
APIMART_API_KEY=your-apimart-key
HUXIAO_APP_ID=your-app-id
HUXIAO_APP_SECRET=your-app-secret
```

### 8.2 虎皮椒申请流程

1. 访问 https://admin.xunhupay.com/
2. 注册账号（个人/企业均可）
3. 实名认证
4. 创建应用，获取 AppID 和 AppSecret
5. 配置回调 URL：`https://your-project.supabase.co/functions/v1/payment-callback`

### 8.3 费率说明

- 个人账号：2% + ¥0.1/笔
- 企业账号：1.5% + ¥0.1/笔
- 支持微信、支付宝

---

## 九、实施步骤

### Week 1: Supabase 后端开发

| 任务 | 说明 | 预计时间 |
|-----|------|---------|
| 注册 Supabase 账号 | 创建项目 | 0.5h |
| 设计数据表 | SQL 建表 | 1h |
| 开发用户注册/登录 | Supabase Auth | 1h |
| 开发积分扣除/退还 | Edge Functions | 2h |
| 开发充值订单 | Edge Functions | 2h |
| 开发支付回调 | Edge Functions | 2h |
| 开发图片生成代理 | Edge Function | 1h |
| 测试所有接口 | Postman/curl | 2h |

### Week 2: 前端集成

| 任务 | 说明 | 预计时间 |
|-----|------|---------|
| 引入 Supabase SDK | CDN 方式 | 0.5h |
| 添加积分显示 UI | 顶部余额显示 | 1h |
| 添加充值 Modal | 套餐选择界面 | 2h |
| 对接用户 API | 注册/登录 | 2h |
| 对接积分 API | 扣除/退还 | 2h |
| 修改生成流程 | 加入积分检查 + 使用 Edge Function | 2h |
| 本地测试 | 端到端测试 | 3h |

### Week 3: 支付与上线

| 任务 | 说明 | 预计时间 |
|-----|------|---------|
| 申请虎皮椒账号 | 个人/企业认证 | 1天 |
| 集成支付接口 | 创建订单/回调 | 2h |
| 支付测试 | 小额真实支付 | 1h |
| 安全加固 | RLS 策略/签名验证 | 2h |
| 部署上线 | Vercel 前端 | 1h |

---

## 十、环境配置

### 10.1 Supabase 环境变量

在 Supabase Dashboard → Settings → Edge Functions 中配置：

```bash
# APIMart API 密钥（不会暴露给前端）
APIMART_API_KEY=sk-your-apimart-key

# 虎皮椒支付配置
HUXIAO_APP_ID=your-huxiao-app-id
HUXIAO_APP_SECRET=your-huxiao-app-secret
```

### 10.2 前端配置

```html
<script>
// Supabase 配置
const SUPABASE_CONFIG = {
  url: 'https://your-project.supabase.co',
  anonKey: 'your-anon-key'  // 从 Supabase Dashboard 获取
};

// 初始化 Supabase
const supabase = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

// 当前用户会话（由 Supabase Auth 管理）
let currentUser = null;
</script>
```

---

## 十一、安全与风控

### 11.1 安全措施

| 措施 | 说明 |
|-----|------|
| HTTPS | 所有 API 通信必须使用 HTTPS（Supabase 自动提供） |
| Row Level Security | 用户只能访问自己的数据 |
| API Key 保护 | APIMart Key 存储在 Edge Functions 环境变量中 |
| 签名验证 | 支付回调必须验证签名 |
| JWT Token | Supabase Auth 自动管理，1小时有效期 |
| 请求限流 | Supabase 免费版 50万次/月 |

### 11.2 Row Level Security 策略

```sql
-- 用户只能查看/更新自己的资料
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- 用户只能查看自己的交易记录
CREATE POLICY "Users can view own transactions" ON public.transactions
  FOR SELECT USING (auth.uid() = user_id);

-- 用户只能查看自己的订单
CREATE POLICY "Users can view own orders" ON public.recharge_orders
  FOR SELECT USING (auth.uid() = user_id);

-- 用户只能查看自己的生成日志
CREATE POLICY "Users can view own logs" ON public.generation_logs
  FOR SELECT USING (auth.uid() = user_id);
```

### 11.3 防刷策略

```typescript
// Edge Function：检测异常请求
async function checkRateLimit(userId: string): Promise<boolean> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // 检查最近1小时请求次数
  const oneHourAgo = new Date(Date.now() - 3600000);
  const { count } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', oneHourAgo.toISOString());

  if (count && count > 50) {
    throw new Error('请求过于频繁，请稍后再试');
  }

  return true;
}
```

---

## 十二、测试清单

### 12.1 功能测试

- [ ] 用户注册成功
- [ ] 用户登录成功
- [ ] 余额正确显示
- [ ] 积分不足时提示
- [ ] 生成成功正确扣费
- [ ] 生成失败正确退费
- [ ] 充值订单创建成功
- [ ] 支付回调正确处理
- [ ] 交易记录正确记录
- [ ] API Key 不暴露给前端

### 12.2 边界测试

- [ ] 余额为0时不能生成
- [ ] 并发生发正确扣费
- [ ] 网络错误时正确处理
- [ ] 重复支付回调幂等性
- [ ] RLS 策略生效

---

## 十三、成本估算

### 13.1 运营成本

| 项目 | 成本 |
|-----|------|
| Supabase 免费版 | ¥0/月 |
| 虎皮椒支付费率 | 2%（按交易额） |
| APIMart API | 按成本（用户支付） |
| 域名 | ¥50-100/年 |
| Vercel 托管 | ¥0/月（免费版） |

### 13.2 收支分析

**盈亏平衡点计算：**

假设平均每用户每月生成 50 张 1K 图片：
- 用户支付：50 × ¥0.40 = ¥20
- APIMart 成本：50 × ¥0.36 = ¥18
- **平台利润：¥2/用户/月**

月活 100 人 → **¥200/月**
月活 500 人 → **¥1,000/月**
月活 1,000 人 → **¥2,000/月**

### 13.3 超出免费额度的成本

Supabase Pro 版本（$25/月）：
- 8GB 数据库
- 100GB 文件存储
- 无限 API 调用

---

## 十四、备选方案：纯前端演示版

如果暂时不想搭建后端，可先用纯前端验证：

### 数据结构

```javascript
// 本地积分数据
const localCredits = {
  balance: 50,  // 新用户赠送50积分
  transactions: []
};

// 保存到 localStorage
localStorage.setItem('credits', JSON.stringify(localCredits));
```

### 扣费函数

```javascript
function deductLocalCredits(cost) {
  const credits = JSON.parse(localStorage.getItem('credits')) || { balance: 0 };

  if (credits.balance < cost) {
    alert('积分不足！请联系管理员充值');
    return false;
  }

  credits.balance -= cost;
  credits.transactions.push({
    type: 'consume',
    amount: -cost,
    timestamp: new Date().toISOString()
  });

  localStorage.setItem('credits', JSON.stringify(credits));
  updateCreditsDisplay();
  return true;
}
```

### ⚠️ 警告

纯前端方案仅适用于演示，用户可通过控制台修改 `localStorage` 无限增加积分。

---

## 十五、总结

### 推荐实施路径

```
立即开始：
1. 注册 Supabase 账号
2. 创建数据表（SQL）
3. 开发 Edge Functions（积分、充值、图片生成）
4. 前端对接测试

第二周：
5. 申请虎皮椒账号
6. 集成支付接口
7. 测试支付流程

第三周：
8. 安全加固（RLS 策略）
9. 上线发布
```

### 关键文件

| 文件 | 说明 |
|-----|------|
| `nanobananapro生图平台.html` | 主应用文件（需修改） |
| `supabase/functions/deduct-credits/index.ts` | 扣除积分 Edge Function |
| `supabase/functions/refund-credits/index.ts` | 退还积分 Edge Function |
| `supabase/functions/create-recharge/index.ts` | 创建充值订单 Edge Function |
| `supabase/functions/payment-callback/index.ts` | 支付回调 Edge Function |
| `supabase/functions/generate-image/index.ts` | 图片生成代理 Edge Function |

### 关键优势

1. **API Key 安全** - 存储在服务端环境变量，前端无法访问
2. **完全控制定价** - 可以随时调整积分价格
3. **用户行为追踪** - 完整的消费记录和生成日志
4. **可扩展** - Supabase 支持平滑升级到付费版
5. **开源友好** - 无厂商锁定

---

**文档版本：** v3.0（Supabase + 带利润定价版）
**创建日期：** 2026-02-06
**更新日期：** 2026-02-06
**作者：** Claude Code
