# AI_for_UrbanDesign 平台优化方案（HTML版本）

## 项目概述

在现有 "Nano Banana Pro" 单文件 HTML 基础上，新增结构化标签、风格参考图上传、图片标注功能、完善用户系统和 IndexedDB 数据持久化。

---

## 一、技术架构

### 1.1 技术选型

**方案：单文件 HTML + 增量开发**

| 优势 | 说明 |
|------|------|
| ⚡ 开发最快 | 直接在现有文件上添加代码 |
| 🚀 快速验证 | 修改即刷新，无需构建 |
| 📦 零依赖 | 不需要安装 Node.js/构建工具 |
| 🎯 专注功能 | 代码全部在一个文件，便于调试 |

### 1.2 技术栈

```yaml
核心框架:
  - 原生 JavaScript (ES6+)
  - 单文件 HTML 架构

UI/样式:
  - Tailwind CSS 3.4+ (CDN，保持现有)
  - Font Awesome 6.4.0 (CDN)
  - CSS Transition (动效)

Canvas/绘图:
  - Fabric.js 6.0+ (CDN)

数据持久化:
  - IndexedDB (原生 API 或 Dexie.js CDN)
  - CryptoJS (CDN，密码加密)
  - browser-image-compression (CDN)

HTTP客户端:
  - Fetch API (原生)
```

### 1.3 CDN 依赖

```html
<!-- 现有依赖 -->
<script src="https://cdn.tailwindcss.com"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

<!-- 新增依赖 -->
<script src="https://cdn.jsdelivr.net/npm/fabric@6.0.0/dist/fabric.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.2.0/crypto-js.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/dexie@3.2.4/dist/dexie.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/browser-image-compression@2.0.2/dist/browser-image-compression.min.js"></script>
```

---

## 二、存储方案设计

### 2.1 多层存储架构

```
┌─────────────────────────────────────────────────┐
│  IndexedDB (主存储)                              │
│  - 用户项目数据                                   │
│  - 历史记录                                       │
│  - 图片(Blob, WebP压缩)                          │
│  容量: 数百MB ~ GB级                              │
├─────────────────────────────────────────────────┤
│  localStorage (配置)                              │
│  - API 密钥(加密)                                 │
│  - 用户会话Token (7天有效期)                      │
│  - 用户偏好设置                                   │
│  容量: ~5MB                                      │
└─────────────────────────────────────────────────┘
```

### 2.2 IndexedDB 数据结构

```javascript
// 使用 Dexie.js 封装

const db = new Dexie('NanoBananaDB');

// 版本1: 数据库结构
db.version(1).stores({
  projects: '++id, userId, name, createdAt',
  generations: '++id, projectId, userId, status, createdAt',
  images: '++id, type, createdAt',
  users: 'id, lastLoginAt'
});

// 数据结构示例
{
  // projects 表
  { id: 1, name: '项目A', userId: 'user123', createdAt: '2026-01-30' },

  // generations 表
  {
    id: 1,
    projectId: 1,
    userId: 'user123',
    prompt: '现代建筑...',
    tags: { scenario: 'urban-planning', ratio: '1:1', quality: '1K' },
    status: 'completed',
    resultImages: [1, 2],
    referenceImages: [3, 4],
    styleReferenceImages: [5],
    createdAt: '2026-01-30'
  },

  // images 表
  { id: 1, blob: Blob, type: 'result', format: 'webp', width: 1024, height: 1024 }
}
```

### 2.3 图片优化策略

- 转换为 WebP 格式
- 最大边长 1920px
- 压缩质量 0.8
- 单文件上限 2MB

---

## 三、功能模块设计

### 3.1 保留现有功能

✅ 用户认证系统
✅ 项目管理（创建/删除/重命名/切换）
✅ AI 图像生成（APIMart API）
✅ 提示词优化
✅ 图片预览 Modal（缩放、平移、下载）
✅ 参数配置（比例、精度、数量）
✅ 生成历史记录
✅ 聚光灯跟随动效

### 3.2 新增功能

#### 功能1: 结构化标签选择

```
应用场景:
  - 城市规划设计
  - 建筑设计
  - 景观设计
  - 概念场景图

画面比例: 1:1, 3:2, 2:3, 4:3, 3:4, 16:9, 9:16, 21:9, 4:5, 5:4

画面质量: 1K, 2K, 4K
```

#### 功能2: 风格参考图片上传

- 允许用户上传风格参考图，影响生成图片的风格
- 单独存储在 `styleReferenceImages` 数组中
- API调用时与标注图一起作为参考图传入

#### 功能3: 图片标注功能

**功能说明：**
用户可以在上传的图片上进行标注（圈选重点、添加文字说明等），标注后的图片自动更新，作为参考图用于生成新图。

**工具列表:**
| 工具 | 说明 |
|------|------|
| 画笔 | 自由绘制，圈选重点区域 |
| 多边形套索 | 精确选择多边形区域 |
| 魔棒 | 基于颜色相似度选择（可调容差） |
| 文字标记 | 在图片上添加标注文字 |

**功能特性:**
- 撤销/恢复（最多50步）
- 画笔/文字颜色选择器
- 笔刷大小调节（1-100px）
- 魔棒容差调节（0-100）

**技术实现:**
- 使用 Fabric.js 作为Canvas引擎
- 标注完成后导出为 base64 图片
- API调用时将标注图作为参考图传入

**流程:**
```
上传图片 → 点击"标注"按钮 → 打开标注Modal
  ↓
标注（画笔/套索/魔棒/文字）→ 导出标注图
  ↓
用户输入提示词
  ↓
调用 API（标注图作为参考图）→ 生成新图
```

#### 功能4: 完善用户系统

- 密码SHA256加密存储（CryptoJS）
- 会话持久化（7天有效期）
- Token验证机制
- 用户偏好设置

#### 功能5: 本地数据持久化

- IndexedDB主存储（GB级容量）
- 自动清理30天前的图片
- 存储容量监控（>80%触发清理）
- 项目导出/导入功能

---

## 四、UI/UX 设计

### 4.1 标注Modal布局

```
┌─────────────────────────────────────────────────────┐
│  图片标注                                    [×]     │
├─────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────┐   │
│  │                                             │   │
│  │           Canvas 标注区域                    │   │
│  │          (Fabric.js)                        │   │
│  │                                             │   │
│  └─────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│  工具栏:                                             │
│  [🖌️画笔] [🔲套索] [🪄魔棒] [📝文字]               │
│  [颜色:🔴] [大小:20px] [容差:30]                   │
│  [↩️撤销] [↪️恢复]                                 │
├─────────────────────────────────────────────────────┤
│  [完成标注] [取消]                                  │
└─────────────────────────────────────────────────────┘
```

### 4.2 结构化标签UI

```
┌─────────────────────────────────┐
│  应用场景                        │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐       │
│  │ 🏙│ │ 🏛│ │ 🌳│ │ 💡│       │
│  │城规│ │建筑│ │景观│ │概念│    │
│  └───┘ └───┘ └───┘ └───┘       │
├─────────────────────────────────┤
│  画面比例                        │
│  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ...  │
│  │1:1│ │3:2│ │2:3│ │4:3│       │
│  └───┘ └───┘ └───┘ └───┘       │
└─────────────────────────────────┘
```

### 4.3 动效方案

- 继续使用现有的聚光灯跟随效果
- CSS Transition 实现基础过渡
- JavaScript 控制 Modal 进出动画

---

## 五、实现步骤

### Week 1: 数据层 + 用户系统

```
Day 1-2:
  [ ] 添加 CDN 依赖 (Fabric.js, Dexie.js, CryptoJS)
  [ ] 初始化 IndexedDB 数据库结构
  [ ] 创建数据操作辅助函数

Day 3-4:
  [ ] 重构用户认证（密码SHA256加密）
  [ ] 实现7天会话持久化
  [ ] 迁移现有 localStorage 数据到 IndexedDB

Day 5-7:
  [ ] 测试数据存储功能
  [ ] 实现自动清理策略
  [ ] 添加存储容量监控
```

### Week 2: 新增UI功能

```
Day 8-10:
  [ ] 结构化标签选择组件
  [ ] 风格参考图上传功能
  [ ] UI 样式调整

Day 11-14:
  [ ] 测试新增功能
  [ ] 优化用户体验
```

### Week 3: 图片标注功能

```
Day 15-17:
  [ ] 集成 Fabric.js
  [ ] 创建标注 Modal
  [ ] 实现画笔工具

Day 18-19:
  [ ] 实现多边形套索工具
  [ ] 实现文字标记工具

Day 20-21:
  [ ] 撤销/恢复系统
  [ ] 颜色选择器、笔刷/容差调节
```

### Week 4: 集成与优化

```
Day 22-24:
  [ ] 集成标注图到生图流程
  [ ] 错误处理
  [ ] 性能优化

Day 25-28:
  [ ] 完整测试
  [ ] Bug 修复
  [ ] 准备发布
```

---

## 六、代码结构

### 6.1 HTML 文件结构

```html
<!DOCTYPE html>
<html>
<head>
  <!-- 现有 meta、title -->
  <!-- CDN 依赖 -->
  <style>
    /* 现有样式 */
    /* 新增：标注相关样式 */
    /* 新增：标签选择样式 */
  </style>
</head>
<body>
  <!-- 现有：认证遮罩 -->
  <!-- 现有：图片预览 Modal -->

  <!-- 新增：标注 Modal -->
  <div id="annotationModal">...</div>

  <!-- 现有：主界面 -->
  <header>...</header>
  <main>
    <!-- 新增：结构化标签选择区 -->
    <section id="tagSelector">...</section>

    <!-- 现有：其他内容 -->
  </main>

  <script>
    // ========== 新增：数据层 ==========
    const db = new Dexie('NanoBananaDB');
    db.version(1).stores({...});

    // ========== 现有：核心逻辑 ==========
    const platformState = {...};

    // ========== 新增：标注功能 ==========
    class AnnotationTool {...}

    // ========== 现有：其他功能 ==========
    function handleLogin() {...}
    function executeSynthesis() {...}
    // ...
  </script>
</body>
</html>
```

### 6.2 核心代码位置

| 功能 | 代码位置（行号） |
|------|-----------------|
| 现有状态管理 | ~131 |
| 用户认证 | ~135-151 |
| 项目管理 | ~153-221 |
| 图片生成 | ~295-333 |
| 聚光灯动效 | ~375 |
| **新增：数据层** | ~130-140（插入） |
| **新增：标注功能** | ~380-450（新增） |
| **新增：标签选择** | ~130-220（扩展） |

---

## 七、API 调用方案

### 图片标注 + 生图流程

```
用户上传图片
  ↓
点击"标注"按钮 → 打开标注 Modal
  ↓
在 Canvas 上标注（画笔/套索/魔棒/文字）
  ↓
点击"完成" → 导出标注图（base64）
  ↓
标注图自动更新到参考图列表
  ↓
用户输入提示词
  ↓
调用 APIMart API → 生成新图
```

### API 请求格式

```javascript
// 标注图作为参考图，生成新图
POST https://api.apimart.ai/v1/images/generations
Headers: {
  "Authorization": "Bearer " + document.getElementById('apiMartKey').value,
  "Content-Type": "application/json"
}
Body: {
  model: "gemini-3-pro-image-preview",
  prompt: document.getElementById('promptInput').value,
  image_urls: [
    platformState.currentAnnotatedImage  // 标注后的图片 base64
  ],
  size: platformState.ratio,
  resolution: platformState.res,
  n: platformState.n
}
```

### 标注图导出

```javascript
// 将 Fabric Canvas 导出为 base64
function exportAnnotatedImage() {
  return canvas.toDataURL({
    format: 'png',
    quality: 1
  });
}
```

---

## 八、关键功能实现示例

### 8.1 IndexedDB 初始化

```javascript
// 数据库初始化
const db = new Dexie('NanoBananaDB');
db.version(1).stores({
  projects: '++id, userId, name, createdAt',
  generations: '++id, projectId, userId, status, createdAt',
  images: '++id, type, createdAt',
  users: 'id, lastLoginAt'
});

// 保存项目
async function saveProject(name, userId) {
  return await db.projects.add({
    name,
    userId,
    createdAt: new Date()
  });
}

// 加载用户项目
async function loadUserProjects(userId) {
  return await db.projects.where('userId').equals(userId).toArray();
}
```

### 8.2 Fabric.js 标注工具

```javascript
// 初始化 Canvas
let canvas;
function initAnnotationCanvas(imageSrc) {
  canvas = new fabric.Canvas('annotationCanvas', {
    width: 800,
    height: 600
  });

  // 加载底图
  fabric.Image.fromURL(imageSrc, function(img) {
    canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas), {
      scaleX: canvas.width / img.width,
      scaleY: canvas.height / img.height
    });
  });

  // 设置默认画笔
  canvas.isDrawingMode = true;
  canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
  canvas.freeDrawingBrush.width = 20;
  canvas.freeDrawingBrush.color = "#ff0000";
}

// 画笔工具
function enableBrush() {
  canvas.isDrawingMode = true;
}

// 文字工具
function addText() {
  const text = new fabric.IText('点击编辑', {
    left: 100,
    top: 100,
    fontFamily: 'Arial',
    fill: '#ff0000',
    fontSize: 24
  });
  canvas.add(text);
  canvas.setActiveObject(text);
}

// 导出标注图
function exportAnnotation() {
  return canvas.toDataURL({
    format: 'png',
    quality: 1
  });
}
```

### 8.3 撤销/恢复

```javascript
const undoStack = [];
const redoStack = [];
const MAX_HISTORY = 50;

function saveState() {
  const state = JSON.stringify(canvas.toJSON());
  undoStack.push(state);
  if (undoStack.length > MAX_HISTORY) {
    undoStack.shift();
  }
  redoStack.length = 0; // 清空重做栈
}

function undo() {
  if (undoStack.length === 0) return;

  const currentState = JSON.stringify(canvas.toJSON());
  redoStack.push(currentState);

  const prevState = undoStack.pop();
  canvas.loadFromJSON(prevState, canvas.renderAll.bind(canvas));
}

function redo() {
  if (redoStack.length === 0) return;

  const currentState = JSON.stringify(canvas.toJSON());
  undoStack.push(currentState);

  const nextState = redoStack.pop();
  canvas.loadFromJSON(nextState, canvas.renderAll.bind(canvas));
}

// 监听变化自动保存
canvas.on('object:added', saveState);
canvas.on('object:modified', saveState);
canvas.on('object:removed', saveState);
```

---

## 九、风险与应对

| 风险 | 应对措施 |
|------|---------|
| 单文件代码过长 | 使用代码折叠、注释分区 |
| IndexedDB 兼容性 | 提供 localStorage 降级方案 |
| 大图片导致崩溃 | 自动压缩 + 分块存储 |
| Fabric.js 性能 | 限制 Canvas 尺寸、使用 Web Worker |
| 用户数据丢失 | 定期自动备份 + 导出功能 |

---

## 十、验证方式

### 功能测试
1. 用户登录后刷新页面，会话保持7天
2. 上传50张图片，IndexedDB正常存储
3. 图片标注工具（画笔/套索/文字）正常工作
4. 撤销/恢复最多50步
5. 标注图正确导出并作为参考图生成新图
6. 结构化标签正确应用到生成请求

### 性能测试
1. 页面加载 < 3s
2. 标注操作 60fps 流畅
3. 图片压缩率 > 60%
4. IndexedDB 存储容量正常

### 兼容性测试
- Chrome 120+, Firefox 120+, Safari 17+, Edge 120+

---

## 十一、预估时间

| 阶段 | 时间 |
|------|------|
| Week 1: 数据层 + 用户系统 | 5-7 天 |
| Week 2: 新增UI功能 | 5-7 天 |
| Week 3: 图片标注功能 | 5-7 天 |
| Week 4: 集成与优化 | 5-7 天 |
| **总计** | **3-4 周** |
