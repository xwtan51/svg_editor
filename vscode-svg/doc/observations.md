# VSCode 现有行为观察（为 S2、S3 准备）

规格 A.2 要求“先观察 VSCode 现有大纲视图的行为，再实现”。本文分成两部分：可以从命令行得到的环境信息已经填好；需要在 GUI 中观察的内容写成待填写的表格。

## 1. 环境（2026-11-13，S1 中由命令行获得）

`code --version`：

```text
1.146.0
69047191fc427f2f92828279aae1d90d8eeda7ab
arm64
```

`code --list-extensions --show-versions`（共 34 个）：

```text
anthropic.claude-code@2.1.322
formulahendry.code-runner@0.12.2
github.codespaces@1.18.17
github.vscode-github-actions@0.32.3
marp-team.marp-vscode@3.6.1
ms-ceintl.vscode-language-pack-zh-hans@1.131.2026090407
ms-python.debugpy@2026.6.0
ms-python.python@2026.10.0
ms-python.vscode-pylance@2026.4.1
ms-python.vscode-python-envs@1.42.0
ms-toolsai.jupyter@2025.9.1
ms-toolsai.jupyter-keymap@1.1.2
ms-toolsai.jupyter-renderers@1.3.0
ms-toolsai.vscode-jupyter-cell-tags@0.1.9
ms-toolsai.vscode-jupyter-slideshow@0.1.6
ms-vscode-remote.remote-ssh@0.128.0
ms-vscode-remote.remote-ssh-edit@0.87.0
ms-vscode.cmake-tools@1.25.10
ms-vscode.cpp-devtools@0.6.18
ms-vscode.cpptools@1.35.6
ms-vscode.cpptools-extension-pack@1.5.1
ms-vscode.makefile-tools@0.12.17
ms-vscode.remote-explorer@0.5.0
oracle.oracle-java@27.0.0
redhat.java@1.58.0
vira.vsc-vira-theme@2026.9.6
vscjava.vscode-gradle@3.19.0
vscjava.vscode-java-debug@0.60.0
vscjava.vscode-java-dependency@0.27.7
vscjava.vscode-java-pack@0.31.2
vscjava.vscode-java-test@0.47.0
vscjava.vscode-maven@0.46.0
vue.volar@3.3.14
wayou.vscode-icons-mac@7.25.3
```

结论：

- **没有安装** `redhat.vscode-xml`，也没有其他声明会处理 XML/SVG 的扩展。`redhat.java` 是 Java 语言支持，与 XML 无关。所以如果 `.svg` 的 Outline 中出现内容，只能来自 VSCode 内置功能。S2 截图时不需要禁用其他扩展。
- 安装了 `ms-vscode-remote.remote-ssh`，所以在远程窗口中，工作区 URI 的 scheme 是 `vscode-remote`（见 README 的 VA6）。
- 安装了图标主题扩展 `wayou.vscode-icons-mac`，Explorer 的图标可能与规格截图不同；规格说明主题和图标不要求一致。F5 的默认配置带 `--disable-extensions`，不受它影响。

## 2. 需要在 GUI 中观察（请填写）

建议在**普通 VSCode 窗口**（不是 F5 的 Extension Development Host）中打开 `vscode-svg/samples/`。下表第 1–4 项看的是**不装本扩展时**的状态。

| # | 观察项 | 操作 | 观察结果 |
|---|---|---|---|
| 1 | `.svg` 文件的语言模式 | 打开 `example.svg`，看窗口右下角状态栏的语言名 | 语言模式为 XML（内置 `vscode.xml` 的别名为 `XML`，API 读取的 `languageId` 为 `xml`）。（自动：VSCode 1.146.0 下载版，`--disable-extensions`） |
| 2 | `.svg` 文件的语言 ID | 点右下角的语言名，弹出列表中当前项括号里的 ID（预期 `xml`） | `example.svg` 的 `languageId` = `xml`。（自动：VSCode 1.146.0 下载版，`--disable-extensions`） |
| 3 | 大写扩展名的语言模式 | 打开 `LOGO.SVG`、`Mixed.Svg`，看右下角（S2 的大纲选择器要与 VA3 一致） | `LOGO.SVG`、`Mixed.Svg` 的 `languageId` 均为 `xml`，对应 XML 语言模式。（自动：VSCode 1.146.0 下载版，`--disable-extensions`） |
| 4 | 不装本扩展时 `.svg` 的 Outline | 打开 `example.svg`，在资源管理器底部展开“大纲”（Outline） | 对 `example.svg` 执行 `vscode.executeDocumentSymbolProvider` 返回 `undefined`，未提供 SVG 符号树。（自动：VSCode 1.146.0 下载版，`--disable-extensions`） |
| 5 | `.md` 的 Outline：层级 | 打开仓库根目录的 `README.md`（或任意含多级标题的 `.md`），看大纲是否按标题嵌套 | 按标题嵌套，共两层：第 1 层 `# svg_editor`，第 2 层 `## 运行`、`## 文档`；没有第 3 层。三个节点的 API kind 均为 `String(14)`。（自动：VSCode 1.146.0 下载版，`--disable-extensions`） |
| 6 | `.md` 的 Outline：点击跳转 | 点击大纲中的某个节点，编辑器是否滚动到该处，选中的是整段还是标题行 | |
| 7 | `.md` 的 Outline：光标跟随 | 在编辑器中移动光标，大纲中的高亮是否跟着变化（大纲视图 `…` 菜单中的“跟随光标”） | |
| 8 | `.md` 的 Outline：编辑后刷新 | 新增或删除一个标题，大纲多久更新一次；输入过程中是否闪烁或清空 | |
| 9 | `.json` 的 Outline（对照） | 打开 `vscode-svg/package.json`，看层级、节点名（键名）和图标；重复第 6–8 项 | 两层，无第 3 层。第 1 层：`name`、`displayName`、`description`、`version`、`publisher`、`main` 为 `String(14)`；`private` 为 `Boolean(16)`；`repository`、`engines`、`contributes`、`scripts`、`devDependencies` 为 `Module(1)`；`categories`、`activationEvents` 为 `Array(17)`。第 2 层：`repository` → `type`、`url`、`directory`；`engines` → `vscode`、`node`；`categories`、`activationEvents` 各有节点 `0`；`scripts` → `build`、`watch`、`typecheck`、`test`、`vscode:prepublish`；`devDependencies` → `@types/node`、`@types/vscode`、`esbuild`、`typescript`、`vitest`；这些子节点均为 `String(14)`。（自动：VSCode 1.146.0 下载版，`--disable-extensions`） |
| 10 | 编辑器标签页上的 `[]` | 用 F5 启动 Extension Development Host，打开 `example.svg`，看标签页标题右侧是否也有 `[]` | |
| 11 | 标签页标记的开关 | 在第 10 项的窗口中把设置 `workbench.editor.decorations.badges` 改为 `false`，标签页上的 `[]` 是否消失（Explorer 中应仍然显示） | |

待人工填写。

填写说明：第 4 项如果为空，大纲面板会显示类似“活动编辑器无法提供大纲信息”的提示，请照抄原文。可以附截图，放在 `vscode-svg/doc/images/`，S3 会用到。
