# 提示词模板功能实施计划

## 一、功能概述

在主平台侧边栏新增"提示词模板"功能，支持三级菜单结构：
- **一级功能**：点击"提示词模板"按钮，侧边栏展开二级功能菜单
- **二级功能**：显示6个功能分类（精细渲染、视角转换、氛围转换、风格转换、替换、分析图绘制）
- **三级功能**：显示具体模板卡片（带图片预览、详情按钮）
- **确认操作**：点击模板后，自动将系统提示词填充到输入框

## 二、UI 设计参考

基于用户提供的 UI 截图分析：

### 图1：二级功能界面
- 左侧文件夹树形结构
- 选中项深色背景高亮
- 文件夹图标 + 名称

### 图2：三级功能界面
- 左侧：文件夹导航（面包屑路径）
- 中间：3列网格布局的模板卡片
- 每个卡片包含：图片、模板标签、名称、详情按钮（左上角白色底红色边框）
- 右侧：模板详情面板（名称、标签、提示词预览等）

## 三、功能层级结构

```
提示词模板
├── 精细渲染 (8项)
│   ├── 总图转鸟瞰
│   ├── 场地重设计（需参考图）
│   ├── 写实风格总图
│   ├── 彩色总平面
│   ├── 鸟瞰图渲染
│   ├── 鸟瞰图渲染（需参考图）
│   ├── 效果图渲染
│   └── 效果图渲染（需参考图）
├── 视角转换 (6项)
│   ├── 鸟瞰视角
│   ├── 箭头指定视角
│   ├── 正面视角
│   ├── 仰视视角
│   ├── 半鸟瞰视角
│   └── 侧面视角
├── 氛围转换 (10项)
│   ├── 早餐
│   ├── 中午
│   ├── 黄昏
│   ├── 夜晚
│   ├── 春天白日
│   ├── 夏天白日
│   ├── 秋天白日
│   ├── 冬天白日
│   ├── 雾天白日
│   └── 雨天白日
├── 风格转换 (7项)
│   ├── 写实风格
│   ├── 手绘风格
│   ├── 插画风格
│   ├── 拼贴风格
│   ├── 亚克力风格
│   ├── 轴测风格
│   └── 木质风格
├── 替换 (4项)
│   ├── 物体替换（需参考图）
│   ├── 材质替换（需参考图）
│   ├── 文字替换
│   └── 内容替换
└── 分析图绘制 (12项)
    ├── 彩色轴测分析图
    ├── 白膜轴测分析图
    ├── 场地分析图
    ├── 功能分区分析图
    ├── 场地规划分析图
    ├── 线稿流线分析图
    ├── 日照分析图
    ├── 建筑爆炸分析图
    ├── 景观爆炸分析图
    ├── 造型演变分析图
    ├── 设计生成分析图
    └── 剖透视分析图
```

## 四、技术架构

### 4.1 新增状态变量

```javascript
// ========== 状态管理 ==========
const platformState = {
    // ... 现有状态 ...
    promptTemplateActive: false,    // 提示词模板功能是否激活
    currentTemplateCategory: null,  // 当前二级功能分类
    currentTemplateId: null         // 当前选中的模板ID
};
```

### 4.2 模板数据结构

```javascript
// ========== 提示词模板数据 ==========
const PROMPT_TEMPLATES = {
    '精细渲染': [
        {
            id: 'masterplan_to_birdseye',
            name: '总图转鸟瞰',
            description: '将平面总图转换为鸟瞰视角',
            // 系统提示词预留位置
            systemPrompt: '', // TODO: 待填充
            // 预览图预留位置
            previewImage: '', // TODO: 待填充（URL或base64）
            needReference: false,
            tags: ['鸟瞰', '总图', '转换']
        },
        // ... 其他模板
    ],
    '视角转换': [
        // ...
    ],
    // ... 其他分类
};
```

### 4.3 新增 HTML 结构

```html
<!-- 侧边栏顶部新增：提示词模板按钮 -->
<section class="mb-6">
    <button onclick="togglePromptTemplate()" id="promptTemplateBtn"
        class="spotlight-btn w-full flex items-center justify-between px-4 py-3 border border-gray-100 rounded-xl bg-white hover:border-gray-300 hover:shadow-md transition-all">
        <div class="flex items-center gap-2">
            <i class="fas fa-magic text-gray-400"></i>
            <span class="text-[10px]">提示词模板</span>
        </div>
        <i id="templateArrow" class="fas fa-chevron-right text-gray-300 text-[8px] transition-transform"></i>
    </button>
</section>

<!-- 提示词模板二级菜单面板（默认隐藏） -->
<div id="templateSecondaryPanel" class="hidden mb-6 pl-4 border-l-2 border-gray-100">
    <!-- 二级功能按钮将通过 JS 动态生成 -->
</div>

<!-- 提示词模板三级内容面板（默认隐藏，全屏或覆盖主工作区） -->
<div id="templateTertiaryPanel" class="hidden fixed inset-0 z-[90] bg-white">
    <!-- 面包屑导航 + 模板卡片网格 + 详情面板 -->
</div>

<!-- 模板详情 Modal -->
<div id="templateDetailModal" class="fixed inset-0 z-[100]" style="display: none;">
    <!-- 模板详情内容 -->
</div>
```

### 4.4 新增 CSS 样式

```css
/* === 提示词模板样式 === */
.template-secondary-btn {
    /* 二级功能按钮样式 */
}

.template-card {
    /* 三级功能卡片样式 */
    position: relative;
    border-radius: 12px;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.3s ease;
}

.template-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 24px rgba(0,0,0,0.15);
}

.template-card .detail-btn {
    position: absolute;
    top: 8px;
    left: 8px;
    background: white;
    border: 1px solid #ff4444;
    color: #000;
    padding: 4px 12px;
    font-size: 10px;
    border-radius: 6px;
    opacity: 0;
    transition: opacity 0.2s;
}

.template-card:hover .detail-btn {
    opacity: 1;
}

.template-tag {
    position: absolute;
    top: 8px;
    right: 8px;
    background: rgba(0,0,0,0.6);
    color: white;
    padding: 2px 8px;
    font-size: 8px;
    border-radius: 4px;
}
```

### 4.5 新增 JavaScript 函数

```javascript
// ========== 提示词模板功能 ==========

/**
 * 切换提示词模板面板的显示/隐藏
 */
function togglePromptTemplate() { }

/**
 * 渲染二级功能菜单
 */
function renderTemplateSecondaryMenu() { }

/**
 * 打开三级功能面板
 * @param {string} category - 二级功能分类名称
 */
function openTemplateTertiaryPanel(category) { }

/**
 * 渲染三级功能模板卡片网格
 * @param {string} category - 二级功能分类名称
 */
function renderTemplateCards(category) { }

/**
 * 打开模板详情 Modal
 * @param {string} templateId - 模板ID
 */
function openTemplateDetailModal(templateId) { }

/**
 * 关闭模板详情 Modal
 */
function closeTemplateDetailModal() { }

/**
 * 应用模板到输入框
 * @param {string} templateId - 模板ID
 */
function applyTemplate(templateId) { }

/**
 * 关闭三级功能面板
 */
function closeTemplateTertiaryPanel() { }
```

## 五、实施步骤

### Phase 1: 数据结构与状态 (代码位置: JavaScript 常量与配置区)

1. 在 `platformState` 中添加新状态变量
2. 创建 `PROMPT_TEMPLATES` 数据结构（包含所有47个模板的占位）

### Phase 2: HTML 结构 (代码位置: 主界面侧边栏 section)

1. 在 `<aside>` 顶部添加"提示词模板"按钮
2. 添加二级功能面板容器 (`templateSecondaryPanel`)
3. 添加三级功能面板容器 (`templateTertiaryPanel`)
4. 添加模板详情 Modal (`templateDetailModal`)

### Phase 3: CSS 样式 (代码位置: <style> 标签内)

1. 添加二级功能按钮样式
2. 添加三级功能卡片样式（hover效果、详情按钮动画）
3. 添加三级功能面板布局样式
4. 添加模板详情 Modal 样式

### Phase 4: JavaScript 核心功能 (代码位置: 新增"提示词模板功能"分区)

1. 实现 `togglePromptTemplate()` - 切换面板显示
2. 实现 `renderTemplateSecondaryMenu()` - 渲染二级菜单
3. 实现 `openTemplateTertiaryPanel()` - 打开三级面板
4. 实现 `renderTemplateCards()` - 渲染模板卡片
5. 实现 `openTemplateDetailModal()` - 打开详情 Modal
6. 实现 `closeTemplateDetailModal()` - 关闭详情 Modal
7. 实现 `applyTemplate()` - 应用模板到输入框
8. 实现 `closeTemplateTertiaryPanel()` - 关闭三级面板

### Phase 5: 事件绑定 (代码位置: 事件监听分区)

1. 绑定键盘 ESC 关闭面板
2. 绑定点击外部区域关闭面板

## 六、系统提示词填充位置

每个模板对象的 `systemPrompt` 字段预留用于填充具体的系统提示词：

```javascript
{
    id: 'masterplan_to_birdseye',
    name: '总图转鸟瞰',
    systemPrompt: `// TODO: 在此填充系统提示词
    例如：专业建筑渲染，将总平面图转换为高质量的鸟瞰视角，
    保持建筑比例和空间关系准确，采用写实渲染风格...`,
    // ...
}
```

## 七、预览图片填充位置

每个模板对象的 `previewImage` 字段预留用于填充预览图片 URL：

```javascript
{
    // ...
    previewImage: 'data:image/svg+xml;base64,...' // 或图片URL
    // ...
}
```

## 八、关键文件修改位置

| 文件 | 修改区域 | 行号范围（预估） |
|------|----------|------------------|
| nanobananapro生图平台.html | `<style>` 样式区 | 18-100 |
| nanobananapro生图平台.html | 侧边栏 HTML | 447-492 |
| nanobananapro生图平台.html | Modal HTML | 92-176 之后 |
| nanobananapro生图平台.html | JavaScript 常量配置 | 246-267 |
| nanobananapro生图平台.html | JavaScript 功能函数 | 1400+ |

## 九、测试验证计划

1. **二级菜单测试**
   - 点击"提示词模板"按钮，二级菜单正确展开/收起
   - 二级功能按钮正确显示（6个分类）

2. **三级面板测试**
   - 点击二级功能，三级面板正确打开
   - 模板卡片正确渲染（3列网格）
   - 面包屑导航正确显示层级

3. **模板卡片测试**
   - hover 时详情按钮正确显示
   - 点击详情按钮，Modal 正确打开
   - 点击卡片本身，提示词正确填充到输入框

4. **详情 Modal 测试**
   - 显示模板完整信息
   - 点击"应用"按钮，提示词正确填充

5. **边界测试**
   - ESC 关闭面板
   - 点击外部区域关闭面板
   - 切换项目时面板状态正确

## 十、扩展性考虑

1. **模板数据外部化**：未来可将 `PROMPT_TEMPLATES` 移至独立 JSON 文件
2. **模板搜索功能**：添加搜索框支持模糊搜索模板
3. **用户自定义模板**：支持用户保存自己的提示词模板
4. **模板收藏功能**：支持收藏常用模板
5. **模板分组**：支持用户自定义模板分组

---

**注意**：本计划仅搭建功能框架，系统提示词和预览图片的具体内容需要后续填充。
