# Nano Banana Pro - 积分系统实施计划

## 一、需求概述

### 1.1 业务目标
- 用户向平台充值积分
- 生成图片时自动扣除积分
- 显示当前余额和消费记录
- **积分按成本定价**（不赚差价）

### 1.2 积分与成本对应关系

| 生成类型 | APIMart 成本 | 消耗积分 | 积分价值 |
|---------|-------------|---------|---------|
| 1K 图片 | $0.05 | 5 积分 | 1 积分 = $0.01 ≈ ¥0.072 |
| 2K 图片 | $0.05 | 5 积分 | 同上 |
| 4K 图片 | $0.10 | 10 积分 | 同上 |

### 1.3 当前架构分析
**现状：**
- 纯前端单文件应用（无后端）
- 用户自己提供 APIMart API Key
- 数据仅存储在本地（IndexedDB + localStorage）
- 无真正的用户验证

**核心问题：**
- 积分系统必须有服务端验证，否则用户可修改本地数据

---

## 二、定价策略

### 2.1 充值套餐（成本定价）

| 充值金额 | 获得积分 | 汇率 | 备注 |
|---------|---------|------|------|
| ¥10 | 139 积分 | ¥0.072/积分 | 体验包 |
| ¥50 | 694 积分 | ¥0.072/积分 | 常用包 |
| ¥100 | 1389 积分 | ¥0.072/积分 | 充值包 |
| ¥500 | 6944 积分 | ¥0.072/积分 | 大容量包 |

**计算说明：** 1 积分 = $0.01 × 7.2（汇率）≈ ¥0.072

### 2.2 生成消耗

| 生成类型 | 消耗积分 | 用户成本 | APIMart 成本 | 平台利润 |
|---------|---------|---------|-------------|---------|
| 1K 单张 | 5 积分 | ¥0.36 | ¥0.36 | 0 |
| 2K 单张 | 5 积分 | ¥0.36 | ¥0.36 | 0 |
| 4K 单张 | 10 积分 | ¥0.72 | ¥0.72 | 0 |
| 批量 N 张 | 基础 × N | - | - | 0 |

**示例：**
- 生成 4 张 1K 图片 = 5 × 4 = 20 积分 = ¥1.44
- 生成 2 张 4K 图片 = 10 × 2 = 20 积分 = ¥1.44

---

## 三、架构方案

### 推荐方案：LeanCloud BaaS（快速上线）

```
前端: 保持现有 HTML
后端: LeanCloud（免费额度）
支付: 虎皮椒 / PayJS（个人友好）
数据库: LeanCloud 内置
```

**优势：**
- 快速上线（1-2周）
- 无需服务器运维
- 免费额度：500请求/秒
- 国内友好，支持微信/支付宝

---

## 四、数据库设计

### 4.1 LeanCloud 数据表

```javascript
// _User 表（用户，LeanCloud 内置）
{
  objectId: string,
  username: string,          // 用户名
  password: string,          // 密码（LeanCloud 自动加密）
  credits: number,           // 当前积分余额
  totalRecharged: number,    // 累计充值金额（元）
  totalConsumed: number,     // 累计消耗积分
  createdAt: Date,
  updatedAt: Date
}

// Transaction 表（交易记录）
{
  objectId: string,
  user: pointer(to _User),   // 关联用户
  type: string,              // 'recharge' | 'consume' | 'refund'
  amount: number,            // 积分变化（正数=增加，负数=减少）
  balanceAfter: number,      // 交易后余额
  description: string,       // 描述
  metadata: object,          // 额外信息 { resolution, count, projectId }
  status: string,            // 'completed' | 'failed'
  createdAt: Date
}

// RechargeOrder 表（充值订单）
{
  objectId: string,
  user: pointer(to _User),
  amount: number,            // 充值金额（元）
  credits: number,           // 获得积分
  method: string,            // 'wechat' | 'alipay'
  status: string,            // 'pending' | 'paid' | 'failed'
  transactionId: string,     // 第三方交易ID
  createdAt: Date,
  paidAt: Date
}

// GenerationLog 表（生成日志）
{
  objectId: string,
  user: pointer(to _User),
  projectId: string,
  prompt: string,
  config: object,            // { ratio, resolution, n }
  cost: number,              // 消耗积分
  apimartTaskId: string,     // APIMart 任务ID
  status: string,
  createdAt: Date
}
```

---

## 五、API 接口设计

### 5.1 用户相关

```
POST /api/user/register
请求: { username, password }
响应: { userId, token }

POST /api/user/login
请求: { username, password }
响应: { userId, token, credits }

GET  /api/user/info?userId=xxx
响应: { username, credits, totalRecharged, totalConsumed }

GET  /api/user/transactions?userId=xxx&limit=20
响应: [{ type, amount, description, createdAt }]
```

### 5.2 积分操作

```
POST /api/credits/deduct
请求: { userId, cost, description, metadata }
响应: { success, balance, transactionId }

POST /api/credits/refund
请求: { transactionId, reason }
响应: { success, balance }

GET  /api/credits/balance?userId=xxx
响应: { balance }
```

### 5.3 充值相关

```
GET  /api/recharge/packages
响应: [{ amount, credits, badge }]

POST /api/recharge/create
请求: { userId, amount, method }
响应: { orderId, paymentUrl, qrCode }

POST /api/recharge/callback
请求: { transactionId, status, sign }
响应: { success, credits }
```

---

## 六、LeanCloud 云函数

### 6.1 用户注册

```javascript
AV.Cloud.define('register', async (request) => {
  const { username, password } = request.params;

  // 检查用户名是否存在
  const query = new AV.Query('_User');
  query.equalTo('username', username);
  const exists = await query.first();

  if (exists) {
    throw new Error('用户名已存在');
  }

  // 创建用户
  const user = new AV.User();
  user.set('username', username);
  user.setPassword(password);
  user.set('credits', 0);  // 初始积分
  user.set('totalRecharged', 0);
  user.set('totalConsumed', 0);

  await user.signUp();

  return {
    userId: user.id,
    username: user.get('username'),
    credits: 0
  };
});
```

### 6.2 扣除积分

```javascript
AV.Cloud.define('deductCredits', async (request) => {
  const { userId, cost, description, metadata } = request.params;

  // 获取用户
  const user = await new AV.Query('_User').get(userId);

  if (!user) {
    throw new Error('用户不存在');
  }

  const balance = user.get('credits');

  // 检查余额
  if (balance < cost) {
    throw new Error(`积分不足！需要 ${cost}，当前 ${balance}`);
  }

  // 扣除积分
  user.set('credits', balance - cost);
  user.increment('totalConsumed', cost);
  await user.save();

  // 记录交易
  const transaction = new AV.Object('Transaction');
  transaction.set('user', user);
  transaction.set('type', 'consume');
  transaction.set('amount', -cost);
  transaction.set('balanceAfter', balance - cost);
  transaction.set('description', description);
  transaction.set('metadata', metadata);
  transaction.set('status', 'completed');
  await transaction.save();

  return {
    success: true,
    balance: balance - cost,
    transactionId: transaction.id
  };
});
```

### 6.3 退还积分

```javascript
AV.Cloud.define('refundCredits', async (request) => {
  const { transactionId } = request.params;

  // 获取原交易记录
  const transaction = await new AV.Query('Transaction').get(transactionId);

  if (!transaction || transaction.get('type') !== 'consume') {
    throw new Error('无效的交易ID');
  }

  const user = transaction.get('user');
  const refundAmount = Math.abs(transaction.get('amount'));

  // 退还积分
  user.increment('credits', refundAmount);
  user.increment('totalConsumed', -refundAmount);
  await user.save();

  // 记录退款交易
  const refundTransaction = new AV.Object('Transaction');
  refundTransaction.set('user', user);
  refundTransaction.set('type', 'refund');
  refundTransaction.set('amount', refundAmount);
  refundTransaction.set('balanceAfter', user.get('credits'));
  refundTransaction.set('description', '生成失败退还');
  refundTransaction.set('status', 'completed');
  await refundTransaction.save();

  return {
    success: true,
    balance: user.get('credits')
  };
});
```

### 6.4 充值订单

```javascript
AV.Cloud.define('createRecharge', async (request) => {
  const { userId, amount, credits, method } = request.params;

  // 创建充值订单
  const order = new AV.Object('RechargeOrder');
  order.set('user', AV.Object.createWithoutData('_User', userId));
  order.set('amount', amount);
  order.set('credits', credits);
  order.set('method', method);
  order.set('status', 'pending');
  await order.save();

  // 调用支付接口（虎皮椒为例）
  const payment = await createHuxiaoPayment({
    orderId: order.id,
    amount: amount,
    title: `充值 ${credits} 积分`
  });

  return {
    orderId: order.id,
    paymentUrl: payment.url,
    qrCode: payment.qrCode
  };
});
```

---

## 七、前端改动

### 7.1 UI 新增组件

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
    <span>预计消耗：<strong>20 积分</strong> (¥1.44)</span>
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

### 7.2 JavaScript 新增代码

```javascript
// ========== 积分系统状态 ==========
const creditsState = {
    balance: 0,
    transactions: [],
    isLoading: false
};

// 充值套餐
const RECHARGE_PACKAGES = [
    { amount: 10, credits: 139, badge: '体验包' },
    { amount: 50, credits: 694, badge: '常用包' },
    { amount: 100, credits: 1389, badge: '充值包', hot: true },
    { amount: 500, credits: 6944, badge: '大容量包', best: true }
];

// ========== 积分消耗计算 ==========
function calculateCost(resolution, count) {
    const baseCost = { '1K': 5, '2K': 5, '4K': 10 };
    return baseCost[resolution] * count;
}

// ========== 获取用户信息 ==========
async function fetchUserInfo() {
    try {
        const response = await fetch(`${LEANCLOUD_URL}/api/user/info?userId=${currentUserId}`, {
            headers: { 'X-LC-Session': sessionToken }
        });
        const data = await response.json();
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
    const yuanCost = (cost * 0.072).toFixed(2);
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
        const response = await fetch(`${LEANCLOUD_URL}/functions/deductCredits`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-LC-Session': sessionToken
            },
            body: JSON.stringify({
                userId: currentUserId,
                cost: cost,
                description: description,
                metadata: metadata
            })
        });

        const result = await response.json();
        if (result.result.success) {
            creditsState.balance = result.result.balance;
            updateCreditsDisplay();
            return result.result;
        }
        throw new Error('扣除积分失败');
    } catch (error) {
        console.error('扣除积分失败:', error);
        alert('扣除积分失败: ' + error.message);
        return null;
    }
}

// ========== 退还积分 ==========
async function refundCredits(transactionId) {
    try {
        const response = await fetch(`${LEANCLOUD_URL}/functions/refundCredits`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-LC-Session': sessionToken
            },
            body: JSON.stringify({ transactionId })
        });

        const result = await response.json();
        if (result.result.success) {
            creditsState.balance = result.result.balance;
            updateCreditsDisplay();
        }
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
        // 调用创建订单接口
        const response = await fetch(`${LEANCLOUD_URL}/functions/createRecharge`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-LC-Session': sessionToken
            },
            body: JSON.stringify({
                userId: currentUserId,
                amount: amount,
                credits: credits,
                method: 'wechat'
            })
        });

        const result = await response.json();

        // 显示支付二维码
        showPaymentQR(result.result.qrCode);

    } catch (error) {
        console.error('创建充值订单失败:', error);
        alert('创建订单失败: ' + error.message);
    }
}
```

### 7.3 修改生成流程

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
        // 3. 调用 APIMart API（原有逻辑）
        const key = document.getElementById('apiMartKey').value;
        const response = await fetch(API_ENDPOINTS.generations, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            },
            body: JSON.stringify({
                model: "gemini-3-pro-image-preview",
                prompt: prompt,
                size: platformState.ratio,
                n: platformState.n,
                resolution: platformState.res,
                image_urls: [...]
            })
        });

        if (!response.ok) throw new Error('API 请求失败');

        const data = await response.json();
        // 4. 轮询任务状态（原有逻辑）
        monitorTask(data.task_id, key, deduction.transactionId);

    } catch (error) {
        console.error('生成失败:', error);

        // 5. 生成失败，退还积分（新增）
        await refundCredits(deduction.transactionId);
        alert('生成失败，积分已退还');
    }
}

// 修改 monitorTask 函数，添加 transactionId 参数
async function monitorTask(tid, key, transactionId) {
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

---

## 八、支付集成（虎皮椒）

### 8.1 虎皮椒配置

```javascript
const HUXIAO_CONFIG = {
  appId: 'your-app-id',
  appSecret: 'your-app-secret',
  apiUrl: 'https://api.xunhupay.com',
  notifyUrl: 'https://your-app.leancloud.cn/api/recharge/callback'
};
```

### 8.2 创建支付订单

```javascript
async function createHuxiaoPayment({ orderId, amount, title }) {
  const params = {
    appid: HUXIAO_CONFIG.appId,
    trade_order_id: orderId,
    total_fee: amount,
    title: title,
    time: Math.floor(Date.now() / 1000),
    notify_url: HUXIAO_CONFIG.notifyUrl,
    nonce_str: Math.random().toString(36).substr(2)
  };

  // 生成签名
  params.sign = generateSignature(params);

  const response = await fetch(`${HUXIAO_CONFIG.apiUrl}/payment/do.html`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });

  return await response.json();
}

function generateSignature(params) {
  const sorted = Object.keys(params).sort()
    .filter(k => k !== 'sign')
    .map(k => `${k}=${params[k]}`)
    .join('&');

  return md5(sorted + HUXIAO_CONFIG.appSecret).toUpperCase();
}
```

### 8.3 支付回调处理

```javascript
AV.Cloud.define('paymentCallback', async (request) => {
  const params = request.params;

  // 1. 验证签名
  const expectedSign = generateSignature(params);
  if (expectedSign !== params.sign) {
    throw new Error('签名验证失败');
  }

  // 2. 查找订单
  const query = new AV.Query('RechargeOrder');
  const order = await query.equalTo('objectId', params.trade_order_id).first();

  if (!order || order.get('status') === 'paid') {
    return { code: 0, msg: 'OK' };  // 避免重复处理
  }

  // 3. 更新订单
  order.set('status', 'paid');
  order.set('transactionId', params.transaction_id);
  order.set('paidAt', new Date());
  await order.save();

  // 4. 增加用户积分
  const user = await order.get('user').fetch();
  user.increment('credits', order.get('credits'));
  user.increment('totalRecharged', order.get('amount'));
  await user.save();

  // 5. 记录交易
  const transaction = new AV.Object('Transaction');
  transaction.set('user', user);
  transaction.set('type', 'recharge');
  transaction.set('amount', order.get('credits'));
  transaction.set('balanceAfter', user.get('credits'));
  transaction.set('description', `充值 ¥${order.get('amount')}`);
  transaction.set('status', 'completed');
  await transaction.save();

  return { code: 0, msg: 'OK' };
});
```

---

## 九、实施步骤

### Week 1: LeanCloud 后端开发

| 任务 | 说明 | 预计时间 |
|-----|------|---------|
| 注册 LeanCloud 账号 | 创建应用 | 0.5h |
| 设计数据表 | 创建 Class | 1h |
| 开发用户注册/登录 | 云函数 | 2h |
| 开发积分扣除/退还 | 云函数 | 2h |
| 开发充值订单 | 云函数 | 2h |
| 开发支付回调 | 云函数 | 3h |
| 测试所有接口 | Postman | 2h |

### Week 2: 前端集成

| 任务 | 说明 | 预计时间 |
|-----|------|---------|
| 添加积分显示 UI | 顶部余额显示 | 1h |
| 添加充值 Modal | 套餐选择界面 | 2h |
| 对接用户 API | 注册/登录 | 2h |
| 对接积分 API | 扣除/退还 | 2h |
| 修改生成流程 | 加入积分检查 | 2h |
| 本地测试 | 端到端测试 | 3h |

### Week 3: 支付与上线

| 任务 | 说明 | 预计时间 |
|-----|------|---------|
| 申请虎皮椒账号 | 个人/企业认证 | 1天 |
| 集成支付接口 | 创建订单/回调 | 4h |
| 支付测试 | 小额真实支付 | 2h |
| 安全加固 | 签名验证/防刷 | 3h |
| 部署上线 | Vercel 前端 | 2h |

---

## 十、环境配置

### 10.1 LeanCloud 环境变量

```javascript
const LEANCLOUD_CONFIG = {
  APP_ID: 'your-app-id',
  APP_KEY: 'your-app-key',
  MASTER_KEY: 'your-master-key',  // 仅服务端
  SERVER_URL: 'https://your-app.leancloud.cn'
};
```

### 10.2 前端配置

```html
<!-- 在 <head> 中引入 LeanCloud SDK -->
<script src="https://cdn.jsdelivr.net/npm/leancloud-storage@4.0.0/dist/av-min.js"></script>

<script>
// 初始化 LeanCloud
AV.init({
  appId: LEANCLOUD_CONFIG.APP_ID,
  appKey: LEANCLOUD_CONFIG.APP_KEY,
  serverURL: LEANCLOUD_CONFIG.SERVER_URL
});

// 当前用户会话
let currentUserId = null;
let sessionToken = null;
</script>
```

---

## 十一、安全与风控

### 11.1 安全措施

| 措施 | 说明 |
|-----|------|
| HTTPS | 所有 API 通信必须使用 HTTPS |
| 密码加密 | LeanCloud 自动 bcrypt 加密 |
| 签名验证 | 支付回调必须验证签名 |
| Token 过期 | 会话 Token 7天有效期 |
| 请求限流 | LeanCloud 免费版 500请求/秒 |

### 11.2 防刷策略

```javascript
// 云函数：检测异常请求
AV.Cloud.define('deductCredits', async (request) => {
  const userId = request.params.userId;

  // 检查最近1小时请求次数
  const oneHourAgo = new Date(Date.now() - 3600000);
  const recentTransactions = await new AV.Query('Transaction')
    .equalTo('user', AV.Object.createWithoutData('_User', userId))
    .greaterThan('createdAt', oneHourAgo)
    .count();

  if (recentTransactions > 50) {
    throw new Error('请求过于频繁，请稍后再试');
  }

  // 继续处理...
});
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

### 12.2 边界测试

- [ ] 余额为0时不能生成
- [ ] 并发生发正确扣费
- [ ] 网络错误时正确处理
- [ ] 重复支付回调幂等性

---

## 十三、成本估算

### 13.1 运营成本

| 项目 | 成本 |
|-----|------|
| LeanCloud 免费版 | ¥0/月 |
| 虎皮椒支付费率 | 2%（按交易额） |
| APIMart API | 按成本（用户支付） |
| 域名 | ¥50-100/年 |

### 13.2 收支分析

由于采用成本定价，平台本身不盈利。

**示例计算：**
- 用户充值 ¥100，获得 1389 积分
- 支付通道费：¥100 × 2% = ¥2
- 可用成本：¥98

用户全部用于生成 2K 图片（5积分/张）：
- 可生成：1389 ÷ 5 = 277 张
- APIMart 成本：277 × $0.05 × 7.2 ≈ ¥99.72

**结论：** 略微亏损（支付通道费），需在定价时预留空间

### 13.3 优化定价（覆盖通道费）

| 充值金额 | 原积分 | 调整后积分 | 说明 |
|---------|-------|-----------|------|
| ¥10 | 139 | 125 | 扣除通道费后可生成 125÷5=25张，成本$0.05×25×7.2=¥9，有盈余 |
| ¥50 | 694 | 625 | 同理 |
| ¥100 | 1389 | 1250 | 同理 |
| ¥500 | 6944 | 6250 | 同理 |

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
1. 注册 LeanCloud 账号
2. 创建数据表
3. 开发云函数（用户、积分、充值）
4. 前端对接测试

第二周：
5. 申请虎皮椒账号
6. 集成支付接口
7. 测试支付流程

第三周：
8. 安全加固
9. 上线发布
```

### 关键文件

| 文件 | 说明 |
|-----|------|
| `nanobananapro生图平台.html` | 主应用文件（需修改） |
| `leancloud/cloud_functions.js` | LeanCloud 云函数 |
| `leancloud/payment_callback.js` | 支付回调处理 |

---

**文档版本：** v2.0（成本定价版）
**创建日期：** 2026-02-05
**作者：** Claude Code