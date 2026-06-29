# 墨仓 | MoCang — Markdown 知识库管理器

一个桌面端 Markdown 文件管理与预览工具，支持编辑、预览、分屏模式，集成 AI 辅助功能。

## 功能特性

- 📂 **文件索引** — 索引电脑上任意位置的 .md 文件
- 👁 **多视图模式** — 编辑、预览、分屏三种视图
- ✏️ **Markdown 编辑** — 完整的工具栏和快捷键支持
- 📑 **目录导航** — 自动提取标题生成目录
- 🔍 **全文搜索** — 搜索所有索引的 MD 文件
- 💾 **自动保存** — 可配置间隔，有改动才保存
- 🔄 **同步滚动** — 分屏模式下编辑器和预览同步滚动
- 🖥️ **桌面应用** — 无边框窗口，原生体验
- 📁 **分组管理** — 文件分组、拖拽排序、嵌套分组
- 🔒 **锁屏功能** — 密码锁屏、空闲自动锁定
- 🎨 **主题切换** — 暗黑/明亮模式、全局透明度、背景模糊
- ⚙️ **设置面板** — 编辑器、界面、锁屏、软件、AI 设置
- 🤖 **AI 辅助** — 一键润色、自定义提示词、多模型支持

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 启动

```bash
# 桌面模式（pywebview 窗口）
python main.py

# 浏览器模式（调试用）
python app.py --web
```

## 构建安装包

项目使用 [pyappify](https://github.com/ok-oldking/pyappify) 打包为 Windows 安装包。

1. 推送代码到 GitHub
2. 打 tag 触发构建：`git tag v0.2.0 && git push --tags`
3. 在 GitHub Releases 页面下载安装包

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+S` | 保存 |
| `Ctrl+B` | 加粗 |
| `Ctrl+I` | 斜体 |
| `Ctrl+K` | 插入链接 |
| `Ctrl+Shift+C` | 代码块 |
| `Ctrl+Shift+Q` | 引用 |
| `Tab` / `Shift+Tab` | 增加/减少缩进 |

## 项目结构

```
MoCang/
├── app.py                  # Flask 主入口 + pywebview 窗口
├── main.py                 # pyappify 入口
├── utils.py                # 共享工具函数
├── pyappify.yml            # pyappify 配置
├── requirements.txt        # Python 依赖
├── routes/                 # Flask 蓝图路由
│   ├── files.py            # 文件 CRUD、内容、搜索
│   ├── groups.py           # 分组 CRUD
│   ├── settings.py         # 设置、锁屏、背景图
│   └── ai.py               # AI 测试、请求
├── prompts/                # AI 提示词模板 (JSON)
│   ├── polish.json         # 文本润色
│   └── default.json        # 通用对话
├── icons/                  # 应用图标
│   └── svgs/               # SVG 图标库
├── static/
│   ├── css/                # 样式（按功能拆分）
│   │   ├── style.css       # 入口（@import）
│   │   ├── variables.css   # CSS 变量 + 主题
│   │   ├── layout.css      # 布局
│   │   ├── components.css  # 组件
│   │   ├── editor.css      # 编辑器
│   │   └── modals.css      # 弹窗
│   ├── js/                 # 前端逻辑（按功能拆分）
│   │   ├── api.js          # API 工具
│   │   ├── state.js        # 全局状态
│   │   ├── files.js        # 文件管理
│   │   ├── groups.js       # 分组管理
│   │   ├── editor.js       # 编辑器
│   │   ├── view.js         # 视图切换
│   │   ├── search.js       # 搜索
│   │   ├── settings.js     # 设置
│   │   └── app.js          # 入口
│   └── vendor/             # 第三方库（本地化）
├── templates/
│   ├── index.html          # 主模板
│   └── partials/           # 局部模板
├── data/                   # 用户数据（不上传）
│   ├── knowledge.json      # 文件索引
│   ├── groups.json         # 分组数据
│   └── settings.json       # 用户设置
└── .github/workflows/
    └── build.yml           # CI 构建配置
```

## 技术栈

- **后端**: Flask (Python)
- **桌面窗口**: pywebview (Edge Chromium)
- **前端**: 原生 HTML / CSS / JS
- **数据存储**: JSON 文件
- **AI 接口**: OpenAI 兼容 API
- **打包**: pyappify (NSIS 安装包)
