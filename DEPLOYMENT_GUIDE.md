# Nano Banana Pro - 用户系统与积分系统部署指南

## 一、部署前准备

### 1.1 所需资源

- [Supabase 账号](https://supabase.com/)（免费）
- APIMart API Key（图像生成服务）

### 1.2 注册 Supabase

1. 访问 https://supabase.com/
2. 点击 "Start your project"
3. 使用 GitHub 账号登录
4. 创建新组织（或使用现有组织）
5. 创建新项目：
   - 项目名称：`nano-banana-pro`
   - 数据库密码：保存好这个密码！
   - 区域：选择离你最近的区域（如 `Southeast Asia (Singapore)`）

### 1.3 获取 APIMart API Key

1. 访问 https://apimart.ai/
2. 注册账号
3. 获取 API Key

---

## 二、Supabase 配置

### 2.1 获取项目凭据

1. 登录 Supabase Dashboard
2. 选择你的项目
3. 进入 **Settings** → **API**
4. 复制以下信息：

   | 项目 | 位置 | 格式示例 |
   |------|------|----------|
   | **Project URL** | "Project URL" 部分 | `https://abc123xyz.supabase.co` |
   | **anon public key** | "Project API keys" → "anon public" | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (很长的 JWT token) |

⚠️ **重要**：
- Project URL 必须以 `https://` 开头
- anon public key 是一个很长的 JWT token，不是短哈希值

### 2.2 创建 Storage Bucket

1. 进入 **Storage** → ** Buckets**
2. 点击 "New bucket"
3. 创建名为 `community-images` 的 bucket
4. 设置为 **Public** bucket

### 2.3 配置环境变量

1. 进入 **Settings** → **Edge Functions**
2. 添加以下环境变量：

| 环境变量名 | 值 | 说明 |
|------------|-----|------|
| `PROJECT_URL` | 你的 Project URL | Supabase 项目 URL |
| `SERVICE_ROLE_KEY` | 你的 service_role key | 用于服务端操作 |
| `APIMART_KEY` | 你的 APIMart API Key | 图像生成 API 密钥 |

⚠️ **注意**：Supabase 会自动在环境变量名称前添加 `SUPABASE_` 前缀。在 Edge Function 代码中，使用 `Deno.env.get('SUPABASE_PROJECT_URL')` 来获取这些值。

**获取 service_role key 的位置：**
1. 进入 **Settings** → **API**
2. 在 "Project API keys" 部分找到 **service_role** 密钥
3. 点击复制（眼睛图标旁边）

---

## 三、数据库设置

### 3.1 执行 Migration

有两种方式执行数据库 migration：

#### 方式 A：使用 Supabase Dashboard（推荐）

1. 进入 **SQL Editor**
2. 点击 "New query"
3. 复制 `supabase/migrations/20250108000001_user_system.sql` 的内容
4. 粘贴到编辑器
5. 点击 "Run" 执行
6. 重复步骤 2-5 执行 `20250108000002_credit_functions.sql`

#### 方式 B：使用 Supabase CLI

```bash
# 安装 Supabase CLI
npm install -g supabase

# 登录
supabase login

# 链接到项目
supabase link --project-ref YOUR_PROJECT_ID

# 推送 migration
supabase db push
```

### 3.2 验证数据库设置

1. 进入 **Table Editor**
2. 确认以下表已创建：
   - `user_credits`
   - `credit_transactions`
   - `generation_logs`
   - `user_projects`
   - `community_posts`

---

## 四、部署 Edge Functions

### 4.1 方式 A：使用 Supabase Dashboard（推荐）

1. 进入 **Edge Functions**
2. 点击 "New Function"
3. 创建以下函数：

#### Function 1: generate-image

1. Function name: `generate-image`
2. 复制 `supabase/functions/generate-image/index.ts` 的内容
3. 粘贴到编辑器
4. 点击 "Deploy"

#### Function 2: check-task

1. Function name: `check-task`
2. 复制 `supabase/functions/check-task/index.ts` 的内容
3. 粘贴到编辑器
4. 点击 "Deploy"

#### Function 3: get-user-credits

1. Function name: `get-user-credits`
2. 复制 `supabase/functions/get-user-credits/index.ts` 的内容
3. 粘贴到编辑器
4. 点击 "Deploy"

#### Function 4: initialize-user-credits

1. Function name: `initialize-user-credits`
2. 复制 `supabase/functions/initialize-user-credits/index.ts` 的内容
3. 粘贴到编辑器
4. 点击 "Deploy"

### 4.2 方式 B：使用 Supabase CLI（推荐用于开发）

```bash
# 安装 Supabase CLI（如果未安装）
npm install -g supabase

# 登录 Supabase
supabase login

# 链接到你的项目
supabase link --project-ref YOUR_PROJECT_ID

# 部署所有函数
supabase functions deploy

# 或部署单个函数
supabase functions deploy generate-image
supabase functions deploy check-task
supabase functions deploy get-user-credits
supabase functions deploy initialize-user-credits
```

### 4.2.1 方式 C：使用部署脚本（最简单）

项目提供了自动部署脚本，可以一键部署所有 Edge Functions：

**Windows 用户：**
```bash
# 在项目根目录运行
deploy-edge-functions.bat
```

**Mac/Linux 用户：**
```bash
# 在项目根目录运行
chmod +x deploy-edge-functions.sh
./deploy-edge-functions.sh
```

脚本会自动：
1. 检查 Supabase CLI 是否已安装
2. 验证登录状态
3. 验证项目链接状态
4. 部署所有 4 个 Edge Functions
5. 显示下一步操作指引

### 4.3 验证 Edge Functions 部署

部署完成后，请验证 Edge Functions 是否正确部署：

#### 方法 A：使用浏览器控制台测试

1. 打开你的应用（已登录状态）
2. 按 F12 打开浏览器控制台
3. 输入以下代码测试：

```javascript
// 测试 get-user-credits 函数
const { data, error } = await supabase.functions.invoke('get-user-credits');
console.log('测试结果:', { data, error });
```

**期望结果：**
- 成功：`{ credits: { balance: 0, ... }, transactions: [], ... }`
- 失败（未部署）：`FunctionsHttpError: Function not found` 或 `404` 错误

#### 方法 B：在 Supabase Dashboard 中验证

1. 进入 **Edge Functions** 页面
2. 确认以下 4 个函数已部署：
   - ✅ `generate-image`
   - ✅ `check-task`
   - ✅ `get-user-credits`
   - ✅ `initialize-user-credits`

#### 方法 C：查看函数日志

1. 进入 **Edge Functions** → 选择某个函数
2. 点击 **Logs** 标签页
3. 查看是否有错误日志

⚠️ **常见问题：**

- **错误：`FunctionsHttpError: Function not found`**
  - 原因：Edge Function 未部署
  - 解决：按照上述步骤部署 Edge Functions

- **错误：`APIMART_KEY not found`**
  - 原因：环境变量未配置
  - 解决：在 **Settings** → **Edge Functions** 中添加 `APIMART_KEY`

- **错误：`Missing authorization header`**
  - 原因：用户未登录
  - 解决：确保用户已登录

---

## 五、前端配置

### 5.1 更新 Supabase 凭据

编辑以下文件，替换 Supabase 凭据：

#### 文件 1: `nanobananapro生图平台.html`

找到以下代码（约第 979-980 行）：

```javascript
const SUPABASE_URL = 'YOUR_SUPABASE_URL';  // 格式：https://xxxxx.supabase.co
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';  // 格式：eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

替换为你的实际凭据：

```javascript
const SUPABASE_URL = 'https://abc123xyz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...(完整的 anon key)';
```

#### 文件 2: `inspiration_community.html`

找到相同的代码块并替换。

⚠️ **验证配置**：
- 保存文件后刷新页面
- 打开浏览器控制台 (F12)
- 如果看到 `✅ Supabase 已初始化` 表示配置成功
- 如果看到 `⚠️ Supabase 未配置` 表示需要检查凭据格式

### 5.2 本地测试

```bash
# 使用本地服务器测试
cd f:\cluade_code\AI_ImageGenerate
npx serve .

# 或使用 Python
python -m http.server 8000
```

访问 http://localhost:3000 或 http://localhost:8000

---

## 六、用户注册流程

### 6.1 注册第一个用户

1. 打开 `nanobananapro生图平台.html`
2. 点击"注册"标签页
3. 输入邮箱和密码（密码至少 6 位）
4. 点击"注册"按钮
5. 如需邮箱验证，请查收邮件并点击验证链接

**注意**：新用户注册后不会获得免费积分，需要充值才能使用。

### 6.2 手动充值（临时方案）

由于未集成支付系统，暂时使用手动充值方式：

1. 用户通过微信/支付宝转账给管理员
2. 管理员在 Supabase Dashboard 手动增加积分：

```sql
-- 在 SQL Editor 中执行
SELECT add_credits(
  'user_id',           -- 用户 ID
  100,                 -- 充值积分
  '手动充值 ¥100',     -- 描述
  '{"type": "manual"}', -- 元数据
  'recharge'           -- 类型
);
```

---

## 七、功能测试清单

### 7.1 用户认证

- [ ] 用户注册成功
- [ ] 用户登录成功
- [ ] 会话持久化（刷新页面后仍登录）
- [ ] 用户登出成功

### 7.2 积分系统

- [ ] 用户注册成功（无初始积分）
- [ ] 积分余额正确显示
- [ ] 生成图片正确扣除积分
- [ ] 生成失败退还积分
- [ ] 积分不足时提示充值

### 7.3 图像生成

- [ ] 1K 图片消耗 5 积分
- [ ] 2K 图片消耗 5 积分
- [ ] 4K 图片消耗 10 积分
- [ ] 批量生成正确计算积分

### 7.4 灵感社区

- [ ] 登录用户可以上传作品
- [ ] 未登录用户无法上传
- [ ] 上传的作品保存在 Supabase
- [ ] 社区内容正确显示

---

## 八、常见问题

### Q1: Edge Functions 报错 "APIMART_KEY not found"

**解决方法：**
确保在 Supabase Dashboard 的 **Settings** → **Edge Functions** 中添加了 `APIMART_KEY` 环境变量。

### Q2: 用户注册后没有获得积分

**解决方法：**
检查 `initialize-user-credits` Edge Function 是否正确部署。在用户登录时应该自动调用此函数。

### Q3: 生成图片后积分没有扣除

**解决方法：**
1. 检查 `generate-image` Edge Function 是否正确部署
2. 检查用户是否有足够的积分
3. 查看浏览器控制台是否有错误

### Q4: 灵感社区无法上传图片

**解决方法：**
1. 确保 `community-images` bucket 已创建并设置为 Public
2. 检查用户是否已登录
3. 查看浏览器控制台是否有错误

### Q5: CORS 错误

**解决方法：**
Edge Functions 已配置 CORS 头。如果仍有问题，在 Supabase Dashboard 的 **Edge Functions** → **Function** 中添加：

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

---

## 九、下一步

### 9.1 集成支付系统

当准备正式运营时，可以集成支付系统：

1. 注册 [虎皮椒](https://www.xunhupay.com/) 或 [PayJS](https://payjs.cn/)
2. 创建 `create-recharge` 和 `payment-callback` Edge Functions
3. 参考计划文档中的支付集成章节

### 9.2 生产环境优化

1. 配置自定义域名
2. 启用 CDN 加速
3. 设置监控和告警
4. 定期备份数据库

---

## 十、联系与支持

如有问题，请参考：

- Supabase 文档：https://supabase.com/docs
- APIMart 文档：https://apimart.ai/docs
- 项目计划文档：[plan_UserSystem.md](plan_UserSystem.md)

---

**文档版本：** v1.0
**创建日期：** 2025-01-08
**作者：** Claude Code
