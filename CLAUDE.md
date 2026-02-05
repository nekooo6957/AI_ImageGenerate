# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Development Commands

This is a **single-file HTML application** with no build process. To run:

```bash
# Simply open the HTML file in a browser
open "nanobananapro生图平台 -用户系统.html"

# Or use a local development server
npx serve .
# Then navigate to http://localhost:3000
```

---

# AI_for_UrbanDesign - Nano Banana Pro

一个基于 AI 的城市设计与建筑图像生成平台。

## 项目概述

**规划建筑景观AI创作平台** 是一个专门为城市规划设计、建筑设计和景观设计行业打造的 Web 端 AI 图像生成平台。它允许设计师通过直观的界面创建、管理和优化 AI 生成的可视化效果图。

### 核心功能

- **用户认证系统** - 基于账号的访问控制，SHA256密码加密，7天会话持久化
- **项目管理** - 创建、重命名、删除、切换设计项目
- **AI 图像生成** - 由 APIMart API 提供支持，使用 Gemini-3-Pro 模型
- **提示词优化** - 使用 Qwen 2.5 进行 AI 驱动的提示词优化
- **参考图系统** - 上传参考图片以引导生成方向
- **风格参考图** - 单独上传风格参考图，影响生成风格
- **图片标注功能** - 基于 Fabric.js 的画笔、套索、魔棒、文字标注工具
- **结构化标签选择** - 应用场景（城市规划设计/建筑设计/景观设计/概念场景图）
- **生成历史记录** - 按项目追踪所有生成的图片
- **交互式画廊** - 平移、缩放和下载生成的图片
- **可配置参数** - 画面比例、精度（1K/2K/4K）、数量（1-4张）
- **IndexedDB 数据持久化** - 使用 Dexie.js 封装，支持大量图片存储

## 文件结构

```
AI_for_UrbanDesign/
├── index.html                                # 营销落地页
├── nanobananapro生图平台 -用户系统.html    # 主应用文件（单文件）
├── plan.md                                   # Next.js 重构方案
├── plan_html.md                              # HTML 版本优化方案
└── CLAUDE.md                                 # 本文档
```

## 架构概览

### 单文件架构

所有功能集成在一个 HTML 文件中，代码按功能分区组织：

```
HTML 结构
├── <head>
│   ├── Meta 标签
│   ├── CDN 依赖引入
│   └── <style> 样式定义
├── <body>
│   ├── 全局 Modal (认证、预览、标注)
│   ├── 页面头部 (API Key 输入、用户信息)
│   ├── 主内容区
│   │   ├── 侧边栏 (项目列表、标签选择、参数配置)
│   │   └── 主工作区 (历史记录、输入区域)
│   └── <script> JavaScript 代码
```

### 数据流

```
用户操作 → platformState 更新 → API 调用
                ↓
        IndexedDB 存储 ← 生成结果
                ↓
        localStorage 降级
```

### 图片生成流程

```
1. 用户输入提示词 → 可选 AI 优化
2. 上传参考图/风格参考图/标注图
3. 选择标签 (场景/比例/精度/数量)
4. 调用 APIMart API
5. 轮询任务状态 (3秒间隔)
6. 完成后显示结果
7. 保存到 IndexedDB + localStorage
```

### 图片标注流程

```
1. 上传图片 → 点击"标注"按钮
2. 打开标注 Modal (Fabric.js Canvas)
3. 选择工具 (画笔/套索/魔棒/文字)
4. 绘制标注
5. 点击"完成" → 导出 base64
6. 标注图作为参考图用于生成
```

## 技术栈

### CDN 依赖

```html
<!-- 样式框架 -->
<script src="https://cdn.tailwindcss.com"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

<!-- 工具库 -->
<script src="https://unpkg.com/fabric@5.3.0/dist/fabric.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.2.0/crypto-js.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/dexie@3.2.4/dist/dexie.min.js"></script>
```

### 后端服务
- **图像生成**: APIMart (gemini-3-pro-image-preview)
- **提示词优化**: SiliconFlow (Qwen/Qwen2.5-72B-Instruct)

## API 配置

### 必需的 API 密钥

1. **APIMart Key** - 用户提供的图像生成密钥
   - 位于页面顶部的输入框（掩码显示）
   - `executeSynthesis()` 函数必需
   - 使用 AES 加密存储在 localStorage

2. **内部 SiliconFlow Key** - 硬编码的提示词优化密钥
   - 用于 `refineWithNarrativeAI()` 函数
   - 当前值: `sk-rudcrnbhwykshkezbwaojyucwlqrfmcoebnmcootdgdehcqc`
   - ⚠️ **安全警告：** 硬编码密钥暴露在源代码中，不应提交到公开仓库

## 核心函数

### 用户系统
| 函数 | 说明 |
|------|------|
| `handleLogin()` | 验证用户身份，创建会话Token，保存到 IndexedDB |
| `initData(user)` | 从 IndexedDB 或 localStorage 加载用户的项目和历史记录 |
| `checkSession()` | 检查会话是否有效（7天有效期），自动恢复登录状态 |
| `handleLogout()` | 重新加载页面以重置会话 |

### 数据层 (IndexedDB)
| 函数 | 说明 |
|------|------|
| `saveProjectToDB(name, userId)` | 保存项目到 IndexedDB |
| `loadProjectsFromDB(userId)` | 从 IndexedDB 加载用户项目 |
| `saveUserToDB(user)` | 保存/更新用户信息 |
| `saveGenerationToDB(generation)` | 保存生成记录 |
| `loadGenerationsFromDB(userId, projectId)` | 加载项目的生成历史 |

### 项目管理
| 函数 | 说明 |
|------|------|
| `createNewProject()` | 创建用户自定义名称的新项目 |
| `deleteProject(name, e)` | 删除项目及其关联的历史记录 |
| `renameProject(name, e)` | 重命名现有项目 |
| `switchProject(name)` | 切换当前活动的项目视图 |
| `renderProjectList()` | 渲染项目列表 |
| `saveAllData()` | 将项目和历史记录持久化到 localStorage（降级方案） |

### 图像生成
| 函数 | 说明 |
|------|------|
| `executeSynthesis()` | 使用当前设置启动图像生成 |
| `monitorTask(tid, key, snapshot)` | 轮询任务状态直到完成 |
| `refineWithNarrativeAI()` | 使用 AI 优化用户提示词 |

### UI 组件
| 函数 | 说明 |
|------|------|
| `openModal()` | 打开图像预览，支持缩放/平移 |
| `createHistoryCard(meta)` | 创建历史记录卡片组件 |
| `fillSuccessCard()` | 用生成的图像更新卡片 |
| `captureAssets(files)` | 处理参考图片上传 |
| `captureStyleAssets(files)` | 处理风格参考图上传 |
| `removeAsset(id)` | 删除参考图片 |
| `removeStyleAsset(id)` | 删除风格参考图 |

### 图片标注
| 函数 | 说明 |
|------|------|
| `openAnnotationModal(imageSrc)` | 打开标注 Modal |
| `closeAnnotationModal()` | 关闭标注 Modal 并清理资源 |
| `initAnnotationCanvas(imageSrc)` | 初始化 Fabric.js Canvas |
| `setTool(tool)` | 切换标注工具（画笔/套索/魔棒/文字） |
| `setupBrushTool()` | 设置画笔工具 |
| `setupLassoTool()` | 设置多边形套索工具 |
| `setupWandTool()` | 设置魔棒工具 |
| `setupTextTool()` | 设置文字工具 |
| `undoAnnotation()` | 撤销操作 |
| `redoAnnotation()` | 恢复操作 |
| `clearAnnotation()` | 清空所有标注 |
| `exportAnnotatedImage()` | 导出标注后的图片 |

## 状态管理

```javascript
platformState = {
    ratio: '1:1',           // 画面比例
    res: '1K',              // 精度
    n: 1,                   // 生成数量
    currentRefImgs: [],     // 参考图片（base64）
    styleReferenceImages: [], // 风格参考图（base64）
    currentAnnotatedImage: null, // 标注后的图片
    currentProject: '默认项目', // 当前活动项目名称
    history: [],            // 生成历史记录
    selectedTags: {         // 结构化标签
        scenario: '',       // 应用场景
        ratio: '1:1',       // 比例标签
        quality: '1K'       // 质量标签
    }
}

annotationState = {
    brushColor: '#ff0000',  // 画笔颜色
    brushSize: 20,          // 画笔大小
    tolerance: 30,          // 魔棒容差
    isDrawing: false,       // 是否正在绘制
    polygonPoints: [],      // 多边形顶点
    undoStack: [],          // 撤销栈
    redoStack: [],          // 恢复栈
    currentImageSrc: null,  // 当前标注图片源
    imageLoaded: false      // 图片是否已加载
}
```

## 支持的画面比例

`1:1`, `3:2`, `2:3`, `4:3`, `3:4`, `16:9`, `9:16`, `21:9`, `4:5`, `5:4`

## 精度选项

- `1K` - 标准质量
- `2K` - 高质量
- `4K` - 超高质量

## 数据持久化

### IndexedDB (主要存储)

使用 Dexie.js 封装，数据库结构：

```javascript
const db = new Dexie('NanoBananaDB');
db.version(1).stores({
    projects: '++id, userId, name, createdAt',
    generations: '++id, projectId, userId, status, createdAt',
    images: '++id, type, createdAt',
    users: 'id, lastLoginAt'
});
```

### localStorage (配置与会话)

- `nano_session` - 用户会话Token（包含 userId, token, expiresAt）
- `nano_api_key` - 加密后的 API 密钥
- `projects_{user}` - 项目名称数组（降级方案）
- `history_{user}` - 生成历史记录对象数组（降级方案）

## 开发说明

### 已知限制

1. 单文件架构导致维护困难
2. SiliconFlow API 密钥硬编码在源代码中（**安全风险**）
3. 无后端 - 所有数据存储在本地浏览器中
4. 图片标注工具在处理大图时可能有性能问题
5. 撤销/恢复栈限制为50步
6. IndexedDB 存储配额取决于浏览器可用磁盘空间（通常可用的 ~50-80%）

### 浏览器兼容性

- 需要支持现代浏览器特性：IndexedDB, Canvas API, ES6+
- 推荐使用 Chrome 90+, Firefox 88+, Safari 14+, Edge 90+

### 用户操作快捷方式

- **粘贴上传图片** - 直接 Ctrl+V 粘贴剪贴板中的图片，自动添加到参考图列表

### 潜在改进方向

- [ ] 将 HTML、CSS 和 JS 文件分离
- [ ] 添加环境变量管理（移除硬编码密钥）
- [ ] 实现带数据库的真正后端
- [ ] 添加基于 JWT 的用户认证
- [ ] 支持多种格式的图像导出
- [ ] 实现协作功能
- [ ] 图片自动清理策略（30天前的图片）
- [ ] 存储容量监控与告警

## API 端点

### 图像生成
```
POST https://api.apimart.ai/v1/images/generations
请求头: { Authorization: Bearer {key}, Content-Type: application/json }
请求体: { model, prompt, size, n, resolution, image_urls }
```

### 任务状态查询
```
GET https://api.apimart.ai/v1/tasks/{task_id}?language=zh
请求头: { Authorization: Bearer {key} }
```

### 提示词优化
```
POST https://api.siliconflow.cn/v1/chat/completions
请求头: { Authorization: Bearer {INTERNAL_SF_KEY}, Content-Type: application/json }
请求体: { model, messages, temperature }
```

## 作者

由 缪文杰 (Miao Wenjie) 创建

## 许可证

请指定许可信息。

---

## HTML 项目代码生成规范

### 代码组织原则

1. **单文件架构** - 所有 HTML、CSS、JavaScript 集成在一个 `.html` 文件中
2. **功能分区** - 使用清晰的注释分隔不同功能模块
3. **自包含** - 通过 CDN 引入依赖，无需本地安装

### HTML 结构规范

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>规划建筑AI创作平台--by 缪文杰</title>

    <!-- CDN 依赖按类型分组 -->
    <!-- 1. 样式框架 -->
    <!-- 2. 图标库 -->
    <!-- 3. 工具库 -->

    <style>
        /* CSS 分区：
           1. CSS 变量定义 (:root)
           2. 全局样式 (body, reset)
           3. 组件样式（按功能分组）
           4. 动效样式
        */
    </style>
</head>
<body>
    <!-- DOM 结构顺序：
         1. 全局 Modal（认证、预览、标注等）
         2. 页面头部
         3. 主内容区
         4. 脚本标签
    -->

    <script>
        // JavaScript 分区：
        // ========== 常量与配置 ==========
        // ========== 数据层 (IndexedDB) ==========
        // ========== 状态管理 ==========
        // ========== 用户系统 ==========
        // ========== 项目管理 ==========
        // ========== 图片处理 ==========
        // ========== 标注功能 ==========
        // ========== API 调用 ==========
        // ========== UI 组件 ==========
        // ========== 事件监听 ==========
    </script>
</body>
</html>
```

### JavaScript 编码规范

#### 命名规范

```javascript
// 常量：全大写，下划线分隔
const INTERNAL_SF_KEY = 'sk-xxx';
const MAX_HISTORY = 50;

// 变量：小驼峰
const currentProject = '默认项目';
const imageTray = document.getElementById('imageTray');

// 函数：小驼峰，动词开头
function handleLogin() {}
function createNewProject() {}
function exportAnnotatedImage() {}

// 类：大驼峰
class AnnotationTool {}
class StorageManager {}

// DOM 元素变量：以元素类型结尾
const userAccountInput = document.getElementById('userAccount');
const loginButton = document.querySelector('.login-btn');
const annotationModal = document.getElementById('annotationModal');
```

#### 代码分区注释

```javascript
// ========== 常量与配置 ==========
const API_ENDPOINTS = {
    generations: 'https://api.apimart.ai/v1/images/generations',
    tasks: 'https://api.apimart.ai/v1/tasks/'
};
const INTERNAL_SF_KEY = 'sk-rudcrnbhwykshkezbwaojyucwlqrfmcoebnmcootdgdehcqc';
const MAX_HISTORY = 50;
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7天

// ========== 数据层 (IndexedDB) ==========
const db = new Dexie('NanoBananaDB');
db.version(1).stores({
    projects: '++id, userId, name, createdAt',
    generations: '++id, projectId, userId, status, createdAt',
    images: '++id, type, createdAt',
    users: 'id, lastLoginAt'
});

// 数据操作辅助函数
async function saveProjectToDB(name, userId) { ... }
async function loadProjectsFromDB(userId) { ... }
async function saveUserToDB(user) { ... }
async function saveGenerationToDB(generation) { ... }
async function loadGenerationsFromDB(userId, projectId) { ... }

// 加密工具函数
function hashPassword(password) { ... }
function encryptApiKey(apiKey) { ... }
function decryptApiKey(encryptedKey) { ... }

// ========== 状态管理 ==========
const platformState = {
    ratio: '1:1',
    res: '1K',
    n: 1,
    currentRefImgs: [],
    styleReferenceImages: [],
    currentAnnotatedImage: null,
    currentProject: '默认项目',
    history: [],
    selectedTags: {
        scenario: '',
        ratio: '1:1',
        quality: '1K'
    }
};

const annotationState = {
    brushColor: '#ff0000',
    brushSize: 20,
    tolerance: 30,
    isDrawing: false,
    polygonPoints: [],
    undoStack: [],
    redoStack: [],
    currentImageSrc: null,
    imageLoaded: false
};

// ========== 用户系统 ==========
async function handleLogin() { ... }
async function initData(user) { ... }
async function checkSession() { ... }
function handleLogout() { ... }

// ========== 项目管理 ==========
function createNewProject() { ... }
function deleteProject(name, e) { ... }
function renameProject(name, e) { ... }
function switchProject(name) { ... }
function renderProjectList() { ... }
function saveAllData() { ... }

// ========== 图片处理 ==========
function captureAssets(files) { ... }
function removeAsset(id) { ... }
function captureStyleAssets(files) { ... }
function removeStyleAsset(id) { ... }

// ========== 标注功能 ==========
async function openAnnotationModal(imageSrc) { ... }
function closeAnnotationModal() { ... }
function initAnnotationCanvas(imageSrc) { ... }
function setTool(tool) { ... }
function setupBrushTool() { ... }
function setupLassoTool() { ... }
function setupWandTool() { ... }
function setupTextTool() { ... }
function undoAnnotation() { ... }
function redoAnnotation() { ... }
function clearAnnotation() { ... }
function exportAnnotatedImage() { ... }

// ========== API 调用 ==========
async function executeSynthesis() { ... }
async function monitorTask(tid, key, snapshot) { ... }
async function refineWithNarrativeAI() { ... }

// ========== UI 组件 ==========
function openModal(resultUrl, prompt, config, inputImgList) { ... }
function createHistoryCard(meta) { ... }
function fillSuccessCard(card, url, meta) { ... }
function closeModal() { ... }
function downloadCurrentImage() { ... }

// ========== 事件监听 ==========
// 统一放在文件末尾
document.addEventListener('DOMContentLoaded', function() { ... });
document.addEventListener('mousemove', e => { ... });
document.addEventListener('paste', e => { ... });
```

#### 函数编写规范

```javascript
// 1. 函数声明使用 function 关键字（便于调试栈追踪）
function executeSynthesis() {
    // 函数体
}

// 2. async/await 处理异步
async function saveProject(name) {
    try {
        const id = await db.projects.add({ name, createdAt: new Date() });
        return id;
    } catch (error) {
        console.error('保存项目失败:', error);
        showErrorToast('保存失败，请重试');
    }
}

// 3. 参数验证在函数开始
function createNewProject() {
    const name = prompt("项目名称");
    if (!name) return;  // 空值直接返回
    if (projects.includes(name)) {
        alert("项目名称已存在");
        return;
    }
    // 继续处理
}

// 4. 单一职责原则
function renderProjectList() { /* 只负责渲染 */ }
function saveAllData() { /* 只负责保存 */ }
```

#### 错误处理规范

```javascript
// API 调用必须包含错误处理
async function executeSynthesis() {
    const key = document.getElementById('apiMartKey').value;
    if (!key) {
        alert("请输入生图引擎密钥");
        return;
    }

    try {
        const response = await fetch(API_ENDPOINTS.generations, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            },
            body: JSON.stringify({ /* ... */ })
        });

        if (!response.ok) {
            throw new Error(`API 请求失败: ${response.status}`);
        }

        const data = await response.json();
        // 处理成功响应
    } catch (error) {
        console.error('生图失败:', error);
        showErrorToast('生图失败: ' + error.message);
    }
}
```

### CSS 样式规范

#### 样式组织

```css
/* 1. CSS 变量 */
:root {
    --bg: #fdfdfd;
    --border: #f0f0f0;
    --primary: #000;
}

/* 2. 全局样式 */
body {
    font-family: "Inter", "PingFang SC", sans-serif;
    background: var(--bg);
    color: #111;
}

/* 3. 组件样式（按功能分组） */
/* === Modal 样式 === */
#imgModal { ... }
#authOverlay { ... }
#annotationModal { ... }  /* 新增 */

/* === 按钮样式 === */
.spotlight-btn { ... }
.btn-black { ... }
.active-tag { ... }

/* === 项目列表样式 === */
.project-item { ... }

/* 4. 动效样式 */
.no-scrollbar::-webkit-scrollbar { display: none; }
```

#### Tailwind CSS 使用

```html
<!-- 优先使用 Tailwind 工具类 -->
<div class="flex items-center gap-4 px-6 py-3 rounded-xl border border-gray-100">

<!-- 复杂样式在 <style> 中定义 -->
<style>
.custom-animated-class {
    transition: all 0.3s cubic-bezier(0.2, 0, 0.2, 1);
}
</style>
```

### 注释规范

```javascript
// ========== 功能分区注释 ==========
// ========== 数据层 ==========

// 单行注释：解释代码意图
// 检查 API Key 是否存在
if (!key) return alert("请输入生图引擎密钥");

// 函数注释：简明扼要
// 打开图片预览 Modal，支持缩放/平移
function openModal(resultUrl, prompt = '', config = '', inputImgList = []) {
    // ...
}

// TODO 注释：标记待完成
// TODO: 实现图片导出为多种格式

// FIXME 注释：标记需要修复
// FIXME: 撤销功能在某些情况下不工作
```

### 事件监听规范

```javascript
// 统一放在文件末尾
document.addEventListener('mousemove', (e) => {
    document.querySelectorAll('.spotlight-btn').forEach(btn => {
        const rect = btn.getBoundingClientRect();
        btn.style.setProperty('--x', `${e.clientX - rect.left}px`);
        btn.style.setProperty('--y', `${e.clientY - rect.top}px`);
    });
});

// 粘贴事件
document.addEventListener('paste', (e) => {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (let item of items) {
        if (item.kind === 'file') captureAssets([item.getAsFile()]);
    }
});
```

---

## AI 代码生成系统提示词

### 角色定义

你是一个专业的前端工程师，专注于为 "Nano Banana Pro" AI 城市设计生图平台开发单文件 HTML 应用。

### 技术约束

1. **单文件架构** - 所有代码必须在一个 `.html` 文件中
2. **原生 JavaScript** - 不使用 React/Vue 等框架
3. **CDN 依赖** - 通过 CDN 引入必要的库
4. **保持现有风格** - 代码风格必须与现有代码一致

### 代码生成规则

#### 1. 函数声明

```javascript
// ✅ 正确：使用 function 关键字
function handleLogin() {
    const user = document.getElementById('userAccount').value;
    // ...
}

// ❌ 错误：不要使用箭头函数作为顶级函数
const handleLogin = () => {
    // ...
};
```

#### 2. 状态管理

```javascript
// 所有状态存储在 platformState 对象中
const platformState = {
    ratio: '1:1',
    res: '1K',
    n: 1,
    currentRefImgs: [],
    styleReferenceImages: [],  // 新增必须添加到这里
    currentProject: '默认项目',
    history: []
};
```

#### 3. DOM 操作

```javascript
// 使用原生 DOM API
const element = document.getElementById('elementId');
const elements = document.querySelectorAll('.class-name');

// 事件绑定
element.addEventListener('click', handleClick);
element.onclick = handleClick;  // 对于简单事件也可以
```

#### 4. 异步处理

```javascript
// 使用 async/await
async function saveData() {
    try {
        await db.projects.add({ name: '新项目' });
    } catch (error) {
        console.error('保存失败:', error);
    }
}

// 轮询使用 setInterval
const timer = setInterval(async () => {
    const result = await checkStatus();
    if (result.completed) {
        clearInterval(timer);
    }
}, 3000);
```

#### 5. 数据存储

```javascript
// 新功能使用 IndexedDB (Dexie.js)
await db.projects.add({ name: '项目A' });
const projects = await db.projects.toArray();

// 简单配置使用 localStorage
localStorage.setItem('apiKey', encryptedKey);
```

#### 6. Modal 结构

```html
<!-- 新 Modal 必须遵循现有结构 -->
<div id="newModal" class="fixed inset-0 z-[100] flex" style="display: none;">
    <div class="modal-backdrop">...</div>
    <div class="modal-content">...</div>
</div>
```

#### 7. 样式约定

```html
<!-- 继续使用 Tailwind CSS 工具类 -->
<div class="flex items-center gap-4 px-6 py-3 rounded-xl">

<!-- 自定义样式在 <style> 中定义 -->
<style>
.new-modal {
    background: rgba(255, 255, 255, 0.99);
    backdrop-filter: blur(25px);
}
</style>
```

### 代码分区要求

生成的代码必须按照以下分区组织：

```javascript
<script>
// ========== 常量与配置 ==========
// API_ENDPOINTS, INTERNAL_SF_KEY, MAX_HISTORY, SESSION_DURATION

// ========== 数据层 ==========
// db (Dexie实例), 数据操作辅助函数, 加密工具函数

// ========== 状态管理 ==========
// platformState, annotationState

// ========== 用户系统 ==========
// handleLogin, initData, checkSession, handleLogout

// ========== 项目管理 ==========
// createNewProject, deleteProject, renameProject, switchProject, renderProjectList, saveAllData

// ========== 图片处理 ==========
// captureAssets, removeAsset, captureStyleAssets, removeStyleAsset

// ========== 标注功能 ==========
// openAnnotationModal, closeAnnotationModal, initAnnotationCanvas, setTool, setupBrushTool, setupLassoTool, setupWandTool, setupTextTool, undoAnnotation, redoAnnotation, clearAnnotation, exportAnnotatedImage

// ========== API 调用 ==========
// executeSynthesis, monitorTask, refineWithNarrativeAI

// ========== UI 组件 ==========
// openModal, createHistoryCard, fillSuccessCard, closeModal, downloadCurrentImage

// ========== 事件监听 ==========
// DOMContentLoaded, mousemove, paste, color/size/tolerance input
</script>
```

### 代码质量要求

1. **错误处理** - 所有 API 调用和异步操作必须有 try-catch
2. **参数验证** - 函数开始处验证必要参数
3. **边界检查** - 数组访问、DOM 操作前检查是否存在
4. **内存管理** - 及时清理定时器、事件监听器
5. **用户体验** - 加载状态、错误提示、成功反馈

### 禁止事项

1. ❌ 不要引入 React/Vue/Angular 等框架
2. ❌ 不要使用 TypeScript 类型注解
3. ❌ 不要改变现有的聚光灯动效实现方式
4. ❌ 不要破坏现有功能
5. ❌ 不要使用 ES modules (import/export)
6. ❌ 不要改变 Tailwind CDN 引入方式

### 新功能添加流程

1. 在对应分区添加新函数
2. 更新 `platformState` 或 `annotationState` 添加新状态
3. 如需存储数据，更新 IndexedDB schema 和相关操作函数
4. 添加必要的 CSS 样式
5. 在 HTML 中添加必要的 DOM 结构
6. 添加事件监听器
7. 确保不破坏现有功能

### Modal 结构规范

新 Modal 必须遵循现有结构：

```html
<div id="newModal" class="fixed inset-0 z-[100]" style="display: none;">
    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" onclick="closeNewModal()"></div>
    <div class="absolute inset-0 flex items-center justify-center p-4">
        <div class="bg-white rounded-3xl shadow-2xl flex flex-col max-w-5xl w-full max-h-[85vh] overflow-hidden">
            <!-- 头部 -->
            <div class="flex justify-between items-center px-6 py-4 border-b border-gray-100">
                <h2 class="text-sm font-bold text-gray-700">标题</h2>
                <button onclick="closeNewModal()" class="text-gray-400 hover:text-black">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <!-- 内容区域 -->
            <div class="flex-1 p-6 overflow-y-auto">...</div>
            <!-- 底部操作栏 -->
            <div class="px-6 py-4 border-t border-gray-100">...</div>
        </div>
    </div>
</div>
```

### 代码示例参考

参考现有代码风格（基于 `nanobananapro生图平台 -用户系统.html`）：

| 功能区域 | 代码位置（行号） |
|---------|-----------------|
| CDN 依赖引入 | 7-13 |
| 聚光灯动效 CSS | 18-30 |
| Modal 样式 | 46-60 |
| 认证遮罩 | 64-74 |
| 图片预览 Modal | 76-92 |
| 标注 Modal | 94-176 |
| 主界面布局 | 178-243 |
| 常量与配置 | 246-267 |
| 数据层 | 268-328 |
| 用户系统 | 330-414 |
| 项目管理 | 416-484 |
| 图片预览功能 | 486-521 |
| 提示词优化 | 523-541 |
| 结构化标签 | 543-563 |
| 图像生成 | 565-627 |
| UI 组件 | 629-652 |
| 参考图处理 | 654-711 |
| 标注功能 | 713-1407 |
| 事件监听 | 1409-1411 |

> **注意：** 行号基于当前版本，代码修改后可能发生变化。使用搜索功能定位代码更可靠。

生成的代码必须与现有代码风格保持一致。

