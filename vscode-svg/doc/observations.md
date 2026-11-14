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
| 4 | 不装本扩展时 `.svg` 的 Outline | 打开 `example.svg`，在资源管理器底部展开“大纲”（Outline） | 对 `example.svg` 执行 `vscode.executeDocumentSymbolProvider` 返回 `undefined`，未提供 SVG 符号树。（自动：VSCode 1.146.0 下载版，`--disable-extensions`） 补充界面观察：以默认 Image Preview 打开时，Outline 显示 `The active editor cannot provide outline information.`；重新打开为文本编辑器时，显示 `No symbols found in document 'example.svg'`，均无符号节点。（界面：Codex computer use，VSCode 1.146.0 下载版，英文界面，`--disable-extensions`） |
| 5 | `.md` 的 Outline：层级 | 打开仓库根目录的 `README.md`（或任意含多级标题的 `.md`），看大纲是否按标题嵌套 | 按标题嵌套，共两层：第 1 层 `# svg_editor`，第 2 层 `## 运行`、`## 文档`；没有第 3 层。三个节点的 API kind 均为 `String(14)`。（自动：VSCode 1.146.0 下载版，`--disable-extensions`） |
| 6 | `.md` 的 Outline：点击跳转 | 点击大纲中的某个节点，编辑器是否滚动到该处，选中的是整段还是标题行 | 在仓库外 README 副本中，点击 `## 文档` 后光标为第 23 行第 1 列，点击 `# svg_editor` 后为第 1 行第 1 列；未选中标题文字、标题行或整节，焦点留在 Outline。两个目标当时均已在视口内，未观察到可见滚动。（界面：Codex computer use，VSCode 1.146.0 下载版，英文界面，`--disable-extensions`） |
| 7 | `.md` 的 Outline：光标跟随 | 在编辑器中移动光标，大纲中的高亮是否跟着变化（大纲视图 `…` 菜单中的“跟随光标”） | 新临时配置中 Follow Cursor 默认为关闭（菜单未勾选）。开启后，光标从第 1 行移到“运行”正文第 7 行，Outline 高亮由根标题移到 `## 运行`；关闭后移到第 23 行，高亮仍停在 `## 运行`。已恢复默认关闭状态。为读取菜单和编辑器，临时配置使用 `window.menuStyle="custom"`、`editor.accessibilitySupport="on"`。（界面：Codex computer use，VSCode 1.146.0 下载版，英文界面，`--disable-extensions`） |
| 8 | `.md` 的 Outline：编辑后刷新 | 新增或删除一个标题，大纲多久更新一次；输入过程中是否闪烁或清空 | 根据 146 张窗口截图（新增 69 张、删除 77 张，实际间隔约 195–205 ms），逐字输入 `## 测试` 时节点名随输入更新；输入完成后约 0.06 s 的首张截图已有完整节点，删完后约 0.26 s 的截图已无新增节点（含截图采集耗时，不能视为精确延迟）。采样画面未见整树清空、可见闪烁或原根节点折叠状态重置；不能排除帧间变化。编辑仅在仓库外副本，临时配置同第 7 项。（界面：Codex computer use，VSCode 1.146.0 下载版，英文界面，`--disable-extensions`） |
| 9 | `.json` 的 Outline（对照） | 打开 `vscode-svg/package.json`，看层级、节点名（键名）和图标；重复第 6–8 项 | 两层，无第 3 层。第 1 层：`name`、`displayName`、`description`、`version`、`publisher`、`main` 为 `String(14)`；`private` 为 `Boolean(16)`；`repository`、`engines`、`contributes`、`scripts`、`devDependencies` 为 `Module(1)`；`categories`、`activationEvents` 为 `Array(17)`。第 2 层：`repository` → `type`、`url`、`directory`；`engines` → `vscode`、`node`；`categories`、`activationEvents` 各有节点 `0`；`scripts` → `build`、`watch`、`typecheck`、`test`、`vscode:prepublish`；`devDependencies` → `@types/node`、`@types/vscode`、`esbuild`、`typescript`、`vitest`；这些子节点均为 `String(14)`。（自动：VSCode 1.146.0 下载版，`--disable-extensions`） 补充界面观察：在未编辑的 JSON 副本中，点击 `scripts` / `build` 后光标分别为第 25 行第 3 列 / 第 26 行第 5 列（键名前的开引号处），无文本选区，焦点留在 Outline；目标原已可见。Follow Cursor 默认关闭，开启时从 `name` 移到 `build` 的光标使高亮相应移动；关闭后把光标移到 `private`，高亮仍为 `build`，已恢复关闭。根据新增 83 张、删除 45 张窗口截图（实际间隔约 195–205 ms），`scripts` 中新增 `ui` 键时节点在输入中已出现；完整输入后首张截图（约 0.05 s）已有 `ui x`，删除操作结束后约 1.49 s 的截图节点消失。未完成的 JSON 输入期间出现诊断标记及临时解析层级变化（`build` 曾短暂列在 `ui` 下），完成后恢复；采样画面未见整树清空，`repository` 保持折叠、`scripts` 保持展开，不能排除帧间变化。临时配置同第 7 项，全部编辑在仓库外副本。（界面：Codex computer use，VSCode 1.146.0 下载版，英文界面，`--disable-extensions`） |
| 10 | 编辑器标签页上的 `[]` | 用 F5 启动 Extension Development Host，打开 `example.svg`，看标签页标题右侧是否也有 `[]` | 默认设置下打开 `example.svg`，编辑器标签页文件名右侧也显示 `[]`。（界面：Codex computer use，VSCode 1.146.0 下载版，英文界面，仅加载本扩展） |
| 11 | 标签页标记的开关 | 在第 10 项的窗口中把设置 `workbench.editor.decorations.badges` 改为 `false`，标签页上的 `[]` 是否消失（Explorer 中应仍然显示） | 在该临时窗口将 `workbench.editor.decorations.badges` 设为 `false` 后，`example.svg` 标签页的 `[]` 消失；Explorer 中 `example.svg`、`LOGO.SVG`、`Mixed.Svg` 的 `[]` 仍显示。（界面：Codex computer use，VSCode 1.146.0 下载版，英文界面，仅加载本扩展） |


填写说明：第 4 项如果为空，大纲面板会显示类似“活动编辑器无法提供大纲信息”的提示，请照抄原文。可以附截图，放在 `vscode-svg/doc/images/`，S3 会用到。


## 3. S2 大纲的界面确认

2026-11-13 独立验收 `feat/vscode-outline`（PR #15，被测头提交 `0e09381`）。先阅读 README 的 O1–O9、VA14–VA22、本文第 2 节第 6–9 项，以及规格 A.2 和图 A.2。使用下载版 VSCode、临时 HOME 和三种独立数据目录，以仓库外 samples 副本为工作区；执行 `npm ci && npm run build` 后加载本扩展。系统内置扩展仍存在，未加载日常安装的其他扩展。窗口为 1440×900（16:10），未修改被测源码或仓库 samples。下表的期望为 README 概括；O4b 是补充观察，不把它当作 README 原有步骤。

| 步骤 | 期望（README 概括） | 实际观察 | 结论 |
|---|---|---|---|
| O1：打开 example.svg，展开大纲 | 树为 svg › g#flow › rect#start、g#nested › text；根和容器为花括号图标，叶子为字段图标，无灰色附加文字。 | 实际层级、名称和图标均一致：svg、g#flow、g#nested 为 `{}`，rect#start、text 为蓝色字段图标；text 无 id 后缀。见 [A.2 截图](images/a2-outline.png)。 | 符合 |
| O2：点击 rect#start | 第 3 行第 6 列，光标在 r 前，无文字选区，焦点留在 Outline。 | 状态栏为 `Ln 3, Col 6`，没有 Selected 计数；蓝色整行背景为定位高亮，未选中文字。AX 焦点为 Outline 的 rect#start 行。与第 2 节第 6 项一致；目标原已在视口中，未观察到滚动。 | 符合 |
| O3：开启 Follow Cursor，依次到 hello、结束标签和 rect，再关闭 | 依次高亮 text、g#nested、rect#start；结束标签也属于元素。 | 新配置菜单未勾选 Follow Cursor。开启后在 5:26、6:7、3:6 分别高亮 text、g#nested、rect#start。关闭后移到 5:26，仍高亮 rect#start；菜单再次确认为关闭。 | 符合 |
| O4：第 5 行行尾回车，逐字输入 circle 后撤销 | 未完成输入保留原节点，不闪烁、不清空；完成后在 g#nested 下新增 circle#c。 | 14 张最终窗口帧（含输入前和撤销后）中，原五节点及图标、展开状态保持不变，未见整树清空或可见闪烁。完整输入首帧尚未出现新节点，下一帧已出现 circle#c；底部节点超出原 Outline 可视高度的一部分，出现滚动条，面包屑显示 g#nested › circle#c。已撤销恢复。采样不能排除帧间短暂变化。 | 符合 |
| O4b：在原第 3 行上方新行逐字输入 circle 后撤销 | README 未列此步；对照 VA16 的出错前截断规则及其对中间插入稳定性的说明。 | 首张 `<c` 未闭合帧起只剩 svg › g#flow，rect#start、g#nested、text 消失，g#flow 从花括号变为字段图标。完成输入首帧仍是部分树，下一帧恢复六节点，g#flow 恢复花括号图标。原有容器恢复展开，未观察到展开状态重置或整树清空。已撤销。VA16 关于一般中间插入时树保持不变的说明不能推广到此位置。 | 仅记录 |
| O5：删去 nested 的闭合引号，再补回 | 只剩 svg › g#flow › rect#start；无错误提示，无 outline failed 日志；补回后恢复。 | 缺引号时只剩三个节点，没有错误弹窗，状态栏问题计数为 0；补回后恢复五节点。[缺引号截图](images/a2-incomplete-xml.png)。搜索临时 user-data/logs 下全部日志：`[svg-badge]`、`SVG outline failed` 均为 0 条匹配，扩展宿主有本扩展激活记录。 | 符合 |
| O6：打开 broken.svg | 仅显示 svg › g#ok › rect#first，不显示错误 circle 和后续 text#after。 | 界面恰为 svg › g#ok › rect#first；circle、text#after 均未显示。 | 符合 |
| O7：打开 LOGO.SVG 和 Mixed.Svg | 分别为 svg › circle#dot、svg › rect。 | 两者默认均以 Text Editor 打开，语言为 XML；Outline 分别为 svg › circle#dot、svg › rect。 | 符合 |
| O8：打开 plain.xml 和隐藏文件 .svg | 没有本扩展提供的节点，与未加载扩展的文本编辑器相同。 | 两者均为 XML 文本编辑器，分别显示 `No symbols found in document 'plain.xml'`、`No symbols found in document '.svg'`，没有节点。与第 2 节第 4 项的文本编辑器状态一致。 | 符合 |
| O9：在 example.svg 按 Cmd+Shift+O，输入冒号 | 按种类分组：1 个模块、2 个命名空间、2 个字段。 | 搜索框为 `@:`；列表显示 fields (2)：rect#start、text；modules (1)：svg；namespaces (2)：g#flow、g#nested。 | 符合 |

本轮 O1–O9 均符合；O4b 暴露的是 VA16 稳定性说明的适用范围，而非规格 A.2 的崩溃问题。A.2 允许不完整 XML 时暂时清空，本轮在该场景保留了前缀树。采样图未出现错误弹窗或整树清空；不能排除帧间变化，也不据此断言任意输入下的行为。入库两图均仅含验收 VSCode 窗口，PNG、1600×1000，分别为 291467、275493 字节。
