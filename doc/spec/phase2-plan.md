> **仓库副本说明**：本文件是 `Notes/Lab/Lab1-Phase2-实施计划.md` 的逐字副本，只在开头加了这一段引用块，正文未改。正文中提到的路径与仓库内路径的对应关系：
>
> - `Lab/pj1-phase2/phase_cli_2.md`（规格）→ `doc/spec/phase_cli_2.md`
> - `Notes/Lab/Lab1-Phase2-作业分析.md`（即“分析”）→ `doc/spec/phase2-analysis.md`
> - `Lab/phase_cli_1.md` → `doc/spec/phase_cli_1.md`（仓库里已有，内容相同）

# Lab1 Phase 2 · 分步实施计划（交给 Claude Code 逐步执行）

> 配套：`Notes/Lab/Lab1-Phase2-作业分析.md`（下称“分析”）。规格见 `Lab/pj1-phase2/phase_cli_2.md`（下称“规格”）。
> 执行方式：**严格串行**，一次只开一个 cc 会话；上一步合并到 `main` 之后，才开始下一步。
> 设计决策：分析里的 D1–D18 **不在本计划中定死**，由 cc 在 **S4 设计步骤**里提出方案，评审通过后写入设计文档，之后各步一律以设计文档为准。
> 本文只写每一步的**目标、输入、范围、产出、验收和评审点**。每一步的提示词等到做那一步时再写。
>
> **修订记录（2026-11-14）**：S4 已完成，设计文档 `doc/design-phase2.md` 经 PR #18 合并（`main` = `22217c6`）。按设计文档 §9.3 的“步骤划分的确认与修订”，S5–S15 各节已同步修改（每节中标 **〔S4 修订〕** 的段落）；决策编号在设计文档里叫 X1–X30（X1–X18 对应分析的 D1–D18）。两者如有出入，以设计文档为准。
>
> **进度**：S0–S4 已合并；里程碑 ① 完成（`dcd5f37`）。

---

## 0. 总览

| 步骤 | 名称 | 对应过程节点 | 产出类型 | 评审 |
|---|---|---|---|---|
| S0 | 准备：规格入库、基线会话、`CLAUDE.md` | — | 文档 + 测试数据 | 轻 |
| S1 | VSCode 扩展：文件标记 | ① | 代码 | 轻 |
| S2 | VSCode 扩展：SVG 大纲 + 测试 | ① | 代码 | 轻 |
| S3 | VSCode 扩展：A.3 分析 + 截图 → **里程碑 ①** | ① | 文档 | 中 |
| S4 | **插件化设计文档**（不写代码） | ② | 文档 | **重（最关键）** |
| S5 | 框架 a：目录重构（行为零变化） | ② | 重构 | 中 |
| S6 | 框架 b：`ShapeProvider` + `Command` 扩展点，内置能力插件化，`PluginInstaller` | ② | 代码 | **重** |
| S7 | 框架 c：`AttributeHandler` 管线、`TreeDecorator` 钩子、事件、子部件保护钩子 | ② | 代码 | **重** |
| S8 | 框架 d：插件加载器 + 配置装配 + 失败路径 | ② | 代码 | **重** |
| S9 | 框架 e：metrics 脚本、差异检查脚本、双装配会话运行器 → **里程碑 ②** | ② | 工具 | 中 |
| S10 | 命令插件 `stats` | ③ | 插件 | 轻 |
| S11 | 命令插件 `dir`（适配器）→ **里程碑 ③** | ③ | 插件 | 中 |
| S12 | 图形插件 `box`：方式 A 与方式 B 各演示一次 → **里程碑 ④** | ④ | 插件 | **重** |
| S13 | 树标签插件 `modified-star`（与 `(box)` 并存）→ **里程碑 ⑤** | ⑤ | 插件 | 中 |
| S14 | 双装配一致性 + 基线兼容的系统测试 | ⑥ | 测试 | 中 |
| S15 | 文档收尾：README、ADR、metrics 终版、迭代报告 → **里程碑 ⑥**，打 tag `p2` | ⑥ | 文档 | **重** |
| S16 | 全新 clone 终验（由我来做） | — | 验证 | — |

依赖关系是一条直线：S0 → S1 → … → S16。S1–S3（VSCode）与 CLI 互不依赖，放在最前面只是为了和规格的过程节点顺序保持一致。

> 💡 如果时间特别紧，S1–S3 可以挪到 S9 之后做，不影响 CLI 各步；但过程节点 ① 的 commit 也会随之后移，过程记录里要说明原因。

---

## 1. 每个 cc 会话都要遵守的固定规则

S0 会把这些规则写进仓库根目录的 `CLAUDE.md`，此后每个会话自动读取。每次开会话时，再告诉 cc 本次是哪一步（例如“执行 S6”）。

1. **先读后写**（分级，避免每次把上千行文档全读一遍）：**必读**本计划中本步那一节、规格 `doc/spec/phase_cli_2.md` 中与本步相关的章节、设计文档 `doc/design-phase2.md`（S4 之后才有）；**按需读**分析 `doc/spec/phase2-analysis.md`（仅供参考，不是约束）、`doc/spec/phase_cli_1.md`，以及 `doc/README.md` 中相关的约定补充。
2. **只做本步范围内的事**：每一步都列出了“允许修改”的目录。超出范围的改动先停下来说明理由，不要顺手改。
3. **设计文档优先**：S4 之后，接口、文案、目录和取舍一律以 `doc/design-phase2.md` 为准。实现时发现设计行不通，**停下来**，先提出对设计文档的修订（写明原因），再继续写代码。
4. **范式约束沿用 Phase 1**：面向对象、一类一文件（文件名 = 类名）、字段封装；不写贫血模型、不写过程式自由函数、不按名字 `switch`。
5. **回归不能断**：每一步结束时 `npm run typecheck`、`npm run typecheck:scripts`、`npm test`、`npm run baseline` 四项都要全绿（S1 起已写进 `CLAUDE.md`）。
6. **偏差要登记**：对规格的任何解释或偏离，都记进设计文档的“约定补充”或“已知偏差”，并给出编号。
7. **过程记录**：每一步结束时，在 `doc/process-log.md` 追加一条：做了什么、AI 提了什么建议、发现了什么问题、怎么确认、怎么修正。
8. **提交方式**：每步一个分支（命名见各步），步骤内可以有多个提交，用 PR 合并到 `main`，**不要 squash**（保留每个提交，方便 `git diff C^ C` 判据）。里程碑步骤的最后一个提交以 `milestone(n/6): …` 开头。
9. **不碰 tag**：不得移动 `final`；`p2` 只在 S15 打。

---

## 2. 各步骤

### S0　准备：规格入库、基线会话、`CLAUDE.md`

**目标**：让后续每个 cc 会话都有统一的输入，并在动代码之前固定一份“`final` 的行为基线”。

**输入**：`Lab/pj1-phase2/phase_cli_2.md` 和截图（需要你手动复制进仓库）、本计划、`tests/transcripts/`。

**要做的事**

1. 把规格复制为 `doc/spec/phase_cli_2.md`，两张截图复制到 `doc/spec/docs/images/`（规格正文用的是相对路径 `docs/images/…`，放在这里才能在 GitHub 上正常显示；仓库根的 `docs/` 留给 metrics）；把本计划复制为 `doc/spec/phase2-plan.md`，把分析笔记复制为 `doc/spec/phase2-analysis.md`（计划里所有“分析 §x”的引用都指向这份文件；cc 读不到 `Notes/` 目录）。
2. 新建根目录 `CLAUDE.md`，写入第 1 节的固定规则。
3. 把 Phase 1 的两份会话（`tests/transcripts/spec-6.txt`、`spec-6-1.txt`）转成规格 §6 要求的格式：`doc/transcript/cli-1.txt` 等**只含命令和注释**的输入文件，期望输出和所需的 SVG 夹具分开存放（目录结构由 cc 提出）。
4. 用 `final` 的 CLI 实际运行这些输入，把输出保存为**基线期望输出**；写一个比对脚本，之后每一步都可以一条命令检查“输出是否与 `final` 逐字节一致”。

**允许修改**：`doc/`、`docs/`、`CLAUDE.md`、新的会话目录、比对脚本所在目录（如 `scripts/`）。**不改 `src/`。**

**验收**：在 `main` 上运行比对脚本得到 0 差异；`npm test` 仍是 889 个测试全过。

**分支**：`chore/p2-setup`。

---

### S1　VSCode 扩展：文件标记

**目标**：规格 A.1。Explorer 中 `.svg` 文件旁显示 `[]`，非 SVG 文件和目录不显示。

**要做的事**

1. 新建独立工程 `vscode-svg/`（自带 `package.json` 和构建配置，不与 CLI 共用）。
2. 先观察：在 VSCode 中查看 `.svg` 文件被识别成的语言，以及已有的大纲行为，把观察结果记进 `vscode-svg/` 下的文档草稿（S3 要用）。
3. 实现文件装饰，覆盖以下边界：名字以 `.svg` 结尾的**目录**、大小写不同的扩展名、`.svg` 以外的文件。
4. 把“是否加标记”的判断写成不依赖 `vscode` 模块的类，并给它写单元测试。
5. 写安装/启动步骤（F5 调试运行，和/或打包成 `.vsix`）。

**允许修改**：只有 `vscode-svg/`（以及根目录 `.gitignore`，如有需要）。

**验收**：单元测试通过；你在 Mac 上按 F5 能看到与规格图 A.1 一致的效果。

**分支**：`feat/vscode-badge`。

---

### S2　VSCode 扩展：SVG 大纲

**目标**：规格 A.2。原生 Outline 显示元素层级（`标签名#id` 或 `标签名`），点击能定位，编辑后能更新，XML 不完整时可以清空但不能崩溃。

**要做的事**

1. 由 cc 提出解析方案（需要元素的起止位置；分析 §6.1 已指出 Phase 1 用的 xmldom 没有结束位置），在 PR 描述里说明选择理由。
2. “文本 → 大纲节点树”写成不依赖 `vscode` 的纯逻辑，再用一个适配类转换成 VSCode 的 `DocumentSymbol`。
3. 测试至少覆盖：嵌套分组、无 id 元素、编辑后更新、不完整 XML（规格明确要求的四项）。纯逻辑部分用单元测试；“编辑后更新”用 VSCode 集成测试（只能在你的 Mac 上运行，cc 要写好运行说明）。
4. 准备示例 SVG（可以参照规格截图里的 `example.svg`），另准备一个故意写坏的 SVG。

**允许修改**：只有 `vscode-svg/`。

**验收**：单元测试通过；你在 Mac 上跑通集成测试，并手动确认与图 A.2 一致的效果。

**分支**：`feat/vscode-outline`。

---

### S3　VSCode 扩展：A.3 分析 + 截图 → 里程碑 ①

**目标**：完成第一部分的全部交付。

**要做的事**

1. 你来截图：文件标记、大纲定位，外加两张异常场景（名字以 `.svg` 结尾的目录没有标记；XML 不完整时大纲为空、扩展没有报错）。放到 cc 指定的目录。
2. cc 写 A.3 的三项分析：宿主与插件的职责和注册/回调过程；文件装饰与 Decorator、Adapter 的对应和差异（要结合接口、对象组合和调用关系）；Phase 1 解析、模型、遍历代码的复用评估。分析 §6.3 的提纲可以作为参考，但结论要以 cc 实际实现的代码为依据。
3. 这一部分写在 `vscode-svg/` 自己的文档里；S15 再把要点并入 `doc/README.md`。

**允许修改**：`vscode-svg/`、截图目录、`doc/process-log.md`。

**验收**：截图齐全；分析中的每个论断都能对应到具体代码。最后一个提交为 `milestone(1/6): VSCode 实践`。

**评审点**：PR 合并前发给我看一遍分析。

**分支**：`docs/vscode-analysis`。

---

### S4　插件化设计文档（不写代码）——最关键的一步

**目标**：在写任何框架代码之前，确定整个 CLI 第二部分的设计，**保证后面接入 `stats`、`dir`、`box`、`modified-star` 时内核都不需要改动**。

**输入**：规格第二部分全文、分析 §3（`final` 的现状差距）、§5（各扩展点的要点）、§7（D1–D18 待定点）、§8（规格中的不一致），以及 `final` 的源码与 `doc/README.md`。

**产出**：`doc/design-phase2.md`，至少包含以下内容：

1. **边界**：内核、装配处、插件三类目录的划分；每个现有文件归到哪里；依赖规则以及如何强制执行（architecture test 或包导出限制等）。
2. **四个扩展点的接口**：`ShapeProvider`、`Command`、`TreeDecorator`、`AttributeHandler` 的 TypeScript 签名，以及每个方法的契约（前置条件、后置条件、违约时框架怎样报错）。
3. **支撑设施的接口**：插件接口与 `activate` 契约、插件上下文、事务式注册（暂存、校验、提交、回滚）、文档事件、容器抽象、回显名与树名的拆分、移走必要子部件的保护钩子，以及读回时按元素选择图形提供者的规则。
4. **两种装配**：组合根（方式 A）和加载器（方式 B）怎样共用同一条注册与校验路径；配置文件格式；`contributes` 校验；options 怎样传递；模块名的解析规则；全部失败文案（包括规格没给格式的“求值失败”）；“只装内置能力”时怎样启动。
5. **D1–D18 的决定**：逐条给出决定、备选方案和理由。规格要求的 ADR（至少 3 条）先在这里起草。
6. **规格追溯表**：把规格第二部分 §1–§7 的每一条要求（包括“判据”和“验收清单”）列成一行，写明由哪个机制满足、在哪一步实现、用什么测试验证。
7. **接入演练**：针对 `stats`、`dir`、`box`、`modified-star` 各写一份**代码草图**，只调用第 2、3 项中定义的内核接口。逐项说明为什么接入时内核和既有插件的差异为 0。这一项是本步的核心检验：草图里一旦出现“这里需要内核再加一个……”，就说明设计还有缺口，必须先补进第 2、3 项。
8. **测试计划和步骤划分确认**：确认 S5–S15 的拆分是否可行，需要调整的话给出修订版本。

**允许修改**：只有 `doc/design-phase2.md`（以及 `doc/process-log.md`）。**不改代码。**

**验收**：

- 规格追溯表里没有空行；
- 四份接入演练都能论证内核零改动；
- D1–D18 每一条都有决定；
- 设计文档提到的每个现有文件和类名都真实存在。

**评审点（重）**：把设计文档发给我。我会逐条对照规格和 `final` 源码来评审，重点检查接入演练是否真的不需要改内核、事务和回滚是否严密、两种装配是否真的共用一条路径。修订到通过之后再合并。

**分支**：`docs/design-phase2`。

**状态**：✅ 已完成（PR #18，合并提交 `22217c6`；修订一轮 `70ef05e`）。

---

### S5　框架 a：目录重构（行为零变化）

**目标**：按设计文档的边界搬移文件，**只搬不改**，为后面的 `git diff <内核目录>` 判据打好基础。

**要做的事**

1. 用 `git mv` 搬移，保留文件历史；只修正因为搬移而变化的 import 路径和工程配置（`tsconfig`、`package.json` 脚本、workspaces 等）。
2. 按设计文档更新 architecture test 的路径和依赖规则（这一步还只是“搬家后的旧规则”，新规则在 S6 加入）。
3. 搬移后跑全部测试和基线会话比对。

**〔S4 修订〕具体内容**（设计 §1.1、§1.2.2–1.2.3、§1.4、附录 A、§9.3）：

- 目录：内核 `packages/kernel/src/<模块>/`（51 个文件）；内置插件 `plugins/builtin-shapes/src/`（6 个图形类）、`plugins/builtin-commands/src/`（22 个命令文件）；`io/NodeFileSystem.ts` → `src/adapters/`；`src/cli/` 不搬。共 80 次 `git mv`，逐个按附录 A。
- 工程配置：根 `package.json` 加 `"workspaces": ["packages/*", "plugins/*"]`（**不得**收进 `vscode-svg/`），`npm test` 改为 `vitest run`；新增 `vitest.config.ts`（`include` 为 `tests/**`、`packages/*/tests/**`、`plugins/*/tests/**` 三个 glob）；`tsconfig.json` 的 `include` 改为 glob；新建三个 `package.json`（`@svgframe/kernel`、`@svgframe/plugin-builtin-shapes`、`@svgframe/plugin-builtin-commands`），只写 `name`、`version`、`"private": true`、`"type": "module"`，**不写** `exports` 与 `contributes`；`package-lock.json` 随 `npm install` 更新。
- architecture test：扫描根改为三个 glob，加上“路径 → 模块”的过渡映射，依赖规则 D1–D8 的判定结果与 `final` 相同；L 规则与插件清单相关的检查在 S6 才加。
- Phase 1 的 889 个测试留在根 `tests/`，只改 import 路径。CLI 入口 `src/cli/main.ts` 不动，`BaselinePaths.CLI_ENTRY` 不改。

**允许修改**：全仓库，**但不允许任何行为变化**。

**验收**：`npm test` 的测试数与搬移前一致且全部通过；基线会话与 `final` 逐字节一致；`git diff -M --stat` 中绝大多数条目是重命名。

**分支**：`refactor/p2-layout`。

---

### S6　框架 b：`ShapeProvider` + `Command` 扩展点，内置能力插件化

**目标**：消除 Phase 1 标注的两处“待重构”（图形工厂和命令分发），让六种图形和全部内置命令都通过注册机制装配。

**要做的事**

1. 在内核中定义 `ShapeProvider`、`Command` 扩展点和插件上下文，以及事务式注册器 `PluginInstaller`（暂存、校验、提交、回滚；重复注册在这一步就要能报错）。
2. 把六种图形改成提供者，归入内置插件；把全部内置命令归入内置插件。
3. 引入容器抽象，消除内核对 `g` 这个具体类的依赖（`group`、`in`、`findContainer` 等）；读回改为按元素选择提供者（为将来的 `data-kind` 留好路）；拆分回显名与树名。以上都按设计文档执行。
4. 组合根（方式 A）通过 `PluginInstaller` 装入内置插件。
5. 新增 architecture test：内核不依赖插件和装配处；插件只依赖内核公开 API；内核中不出现按名字枚举图形或命令的代码。
6. 针对扩展点写单元测试：注册、调用、重复注册、缺省行为（未注册类型时报 `unknown shape type`，未注册命令时报 `unknown command`）。

**〔S4 修订〕另加**：内核公开入口 `api.ts`、`host-api.ts` 与内核 `package.json` 的 `exports`；`tsconfig` 加 `resolveJsonModule`；内置插件的 `exports` 与 `contributes`；`EditorAssembler`（此时只有 bare 和 full，`optional()` 为空）；`ShapeReader`、`ElementView`；删除 `Editor.createDefault`；architecture test 加 L1–L4、L6–L8、L10、P5a、P5b，并按设计 §1.2.4 划定 P 规则的适用区域。测试清单见设计 §9.2 的 S6 一行。

**允许修改**：内核、装配处、内置插件目录、测试。〔S4 修订〕即 `packages/kernel`、`src/`、`plugins/builtin-*`、`tests/`、`tsconfig.json`。

**验收**：全部测试通过；基线会话与 `final` 逐字节一致；在内核目录中用 `rg` 搜不到具体图形名或命令名构成的分派。

**评审点（重）**：合并前发给我。我会在本地做一次模拟合并，跑回归，并抽查依赖规则。

**分支**：`feat/p2-registries`。

---

### S7　框架 c：属性处理器、树标签钩子、事件、保护钩子

**目标**：补齐另外两个扩展点，以及 `box` 和 `modified-star` 将来需要的全部内核支撑。

**要做的事**

1. `AttributeHandler`：按设计文档完成 `set` 的处理器查询、冲突规则、一次 `set` 一个 undo 单元、失败时回滚且历史不变，以及无处理器命中时回到 Phase 1 白名单。
2. `TreeDecorator`：渲染器的标签钩子（覆盖根行和图形行），以及拼接顺序。**无标签时输出逐字节不变。**
3. 文档事件（`modified-star` 需要的那些），以及移走容器必要子部件时的保护钩子。
4. 用**测试替身**写契约测试，不依赖任何真实插件：
   - 处理器：命中、未命中、多个处理器同时命中、部分修改后抛错；
   - 树标签：单个标签、多个标签的顺序、无标签时的基线；
   - 事件：各类事件的触发时机；
   - 保护钩子：被拒绝时状态完全不变。

**〔S4 修订〕另加**：只读视图 `ShapeView`、`DocumentView`；`SvgSerializer` 的参数放宽为 `DocumentView`；`CommandContext.markSaved` 取代 `setFilePath`；`AttributePlanner`、`PlannedAttributeEdit` 两个接口以 `type` 导出；P10。测试清单见设计 §9.2 的 S7 一行。

**允许修改**：内核、测试；内置插件只在设计文档要求时才改。〔S4 修订〕即 `packages/kernel`、`tests/`；`plugins/builtin-*` 只限 `markSaved`、`attributeEdits`、`treeDecorators`、`checkReleasable` 的调用处。

**验收**：全部测试通过；基线会话逐字节一致；对照设计文档的接入演练逐项确认 `box` 和 `modified-star` 需要的内核接口都已存在。

**评审点（重）**：合并前发给我。重点看事务和回滚。

**分支**：`feat/p2-extension-points`。

---

### S8　框架 d：插件加载器与配置装配

**目标**：方式 B 可用，并且与方式 A 共用同一条注册与校验路径。

**要做的事**

1. 在装配处实现加载器和配置读取：按数组顺序加载、跳过 `enabled: false`、相对路径以配置文件目录为基准、包名按 Node 规则解析、传递 options、读取并校验 `contributes`。
2. 失败处理：4 类规格给定的失败、重复注册、清单不一致和激活失败时回滚、配置非法时以内置能力启动、求值失败不误报为“找不到”。文案以设计文档为准。
3. CLI 启动参数：`--config <file>`；以及设计文档规定的“只装内置”启动方式。
4. 测试：每条失败路径都有一个专用的假插件夹具；回滚后后续插件照常加载；加载器源码里不出现任何插件名（加一条 architecture test）。
5. 根目录放一份 `plugins.config.json`（此时还没有可选插件，可以是空列表）。

**〔S4 修订〕**：workspaces 已在 S5 完成。启动参数为 `--bare`、`--only <包名>`、`--config <file>` 三者互斥，不带参数等于 full（方式 A 的全部可选插件）；`--config` 的含义是“内置能力 + 配置里的插件”；配置非法时以 bare 启动。加载失败的消息写 stdout，位于 banner 之后、第一条命令的输出之前（`Repl` 新增启动消息）。加载器夹具放在 `tests/fixtures/plugins/`；architecture test 加 L5 与 L9 的加载器部分。**S8 不改 `scripts/`**：基线工具的按会话参数放在 S9。全部文案见设计 §4.5。

**允许修改**：装配处、测试夹具、根目录配置、`package.json`（如需要 workspaces）。**不改内核**；确实需要改时先修订设计文档并说明。〔S4 修订〕即 `src/`、`tests/`、`plugins.config.json`。

**验收**：全部测试通过；用空配置和不用配置两种方式启动，基线会话都与 `final` 逐字节一致。〔S4 修订〕这一项在 S8 用一次性命令手工验证（`--bare` 与 `--config <空配置>`），S9 再固定成 `.runs.json`。

**评审点（重）**：合并前发给我。

**分支**：`feat/p2-loader`。

---

### S9　框架 e：度量与检查工具 → 里程碑 ②

**目标**：把后面每一步都要用的验证工具一次备齐，并产出第一版 metrics。

**要做的事**

1. **metrics 脚本**：从 git 历史生成 `docs/metrics/`，内容包括文件清单与职责、行数按内核 / 装配处 / 插件三类拆分、`final` 与当前提交的圈复杂度对比；VSCode 扩展单独列出；排除依赖和构建产物。⚠️ 仓库用的是 TypeScript 7，`typescript` 包只有 `unstable/*` 接口，解析方式由 cc 先验证再选。
2. **差异检查脚本**：给定提交 `C` 和新插件目录，按规格 §6 的三条判据输出结果。脚本要**先确认每个路径在 `C^` 和 `C` 中都存在**，再运行 diff。
3. **双装配会话运行器**：同一份输入分别用方式 A 和方式 B 运行，比对两份输出。
4. 在 `doc/README.md` 中起草“扩展点清单”（接口名、职责、内核调用位置（文件 + 函数）、已有实现、禁用时的行为、违约时的报错）。此时只有内置实现，后面每个插件步骤再补充。
5. 运行一次 metrics，提交结果。

**〔S4 修订〕**：

- 双装配运行器**就是**基线工具的运行组：`doc/transcript/<会话>.runs.json` 声明每组运行的参数与期望输出，`SessionRunner` 接收参数，不另写第二个 runner（设计 §4.8）。三个已有会话加上 `.runs.json`（`--bare` 与 `--config doc/transcript/configs/empty.json` 两次运行），从此不带参数的 full 怎样增长都不影响基线。
- metrics 的圈复杂度用 `typescript/unstable/sync` 解析（决策 X18，口径见设计 §5.3），脚本启动时先自检（`Tokenizer.readQuoted` 的 $M = 8$）。“职责”一栏取自类注释的第一句，并加一条 architecture test 保证每个源文件都有类注释。
- 差异检查脚本 `npm run plugin-diff -- <C> plugins/<新目录> --mode A|B`，先用 `git cat-file -e` 断言路径存在（设计 §1.5）。
- 通用装配契约测试：对组合根 `optional()` 中每个插件，bare 下它的命令报 `unknown command`，`--only <包名>` 下 `help` 列出它（S10、S11 接入时自动覆盖）。

**允许修改**：`scripts/`（或设计文档指定的工具目录）、`docs/metrics/`、`doc/README.md`、测试。〔S4 修订〕另加 `doc/transcript/`（只加 `.runs.json` 与 `configs/`）和根 `package.json`（只加 `metrics`、`plugin-diff` 两个 npm 脚本）。

**验收**：metrics 可以由脚本复现；差异检查脚本对一个人为构造的“改了内核”的提交能报出失败。最后一个提交为 `milestone(2/6): 框架可扩展`。

**分支**：`chore/p2-tooling`。

---

### 插件步骤的通用做法（S10–S13）

这几步都要满足“接入那次提交，内核和既有插件差异为 0”，所以统一按下面的流程：

1. **草稿**：先在临时分支 `scratch/<插件名>` 上实现并测通。
2. **发现缺口时停下**：如果草稿发现内核还缺东西，**不要**在插件提交里顺手改。先在 `main` 上单独做一个内核修补提交（同样要走 PR，并在过程记录里写明“设计缺口：…”），合并后再继续。
3. **干净提交**：从最新的 `main` 拉正式分支，把插件作为**一个**提交加入，内容只有：新插件目录 + 装配处的一处修改（方式 A 改组合根，方式 B 改配置）+ 必要的测试、文档、依赖元数据。
4. **自检**：对这个提交运行 S9 的差异检查脚本，把输出贴进 PR 描述。

**〔S4 修订〕两段式接入（决策 X24）**：第 3 条的“一个提交”改为两个提交，文档放在同一 PR 的后续提交里：

| 提交 | 内容 | 判据 |
|---|---|---|
| C（接入） | `A plugins/<新目录>/**`、`M src/assembly/CompositionRoot.ts`、`M package-lock.json` | 方式 A + 共同判据 |
| C′（配置） | `M plugins.config.json`，以及该插件需要的会话数据（`doc/transcript/…`） | 只改配置与测试数据 |

`box` 另有演示分支 `demo/box-config` 上的方式 B 提交 C_B（`A plugins/shape-box/**`、`M plugins.config.json`、`M package-lock.json`）。每次接入的完整判据命令和预测的 `--name-status` 见设计 §1.5 与第 8 节。

---

### S10　命令插件 `stats`

**目标**：规格 §2.1、§2.3。

**要做的事**：独立插件包实现 `stats`；插件自己的单元测试使用测试替身提供上下文，不依赖其他插件；装配方式按设计文档选 A 或 B；测试“已加载时出现在 `help` 中、未加载时报 `unknown command`”；在扩展点清单中补充 `stats`。

**〔S4 修订〕**：两种装配都支持（C + C′）；“`help` / `unknown command`”由 S9 的通用装配契约测试自动覆盖，不用另写。设计见 §8.1。**允许修改**：`plugins/command-stats/`、`src/assembly/CompositionRoot.ts`、`plugins.config.json`、`package-lock.json`、`doc/`。

**验收**：差异检查脚本通过；全部测试通过；基线会话（禁用新增插件时）仍与 `final` 逐字节一致。

**分支**：`feat/plugin-stats`。

---

### S11　命令插件 `dir`（适配器）→ 里程碑 ③

**目标**：规格 §2.2、§2.3。

**要做的事**

1. 独立插件包，通过目录访问接口（适配器模式）读取文件系统。
2. 测试替身测试：混合文件与子目录、空目录、隐藏项、读取失败、稳定排序。
3. 真实适配器测试：使用临时目录。
4. 状态测试：没有文档时 `dir` 可用；有文档时，成功或失败都不改变文档、dirty 状态和 undo/redo 历史（包括 io 锁）。
5. 两种装配方式下对同一固定目录运行 `dir`，输出逐字节一致（使用 S9 的运行器；日志写到目录之外）。
6. 在 `doc/README.md` 中写 `dir` 的适配器说明（各个接口和类分别对应 Adapter 的哪个角色），并补充扩展点清单。

**〔S4 修订〕**：C′ 新增 `cli-2.txt`、它的夹具和 `cli-2.runs.json`（只比较 A = B，暂无期望输出；期望输出可以在 S11 经同意后用 `--update cli-2` 生成并手工核对，最晚 S14）。`cli-2` 不含 `tree`、`save`，所以 S12、S13 的接入提交 C 不会让它失配。输出格式按设计：`[DIR]  name`、`[FILE] name`（名字对齐，偏差 T2）；排序按 UTF-16 码元；符号链接跟随一层；读取失败的 `<path>` 是当前目录的绝对路径。设计见 §8.2。**允许修改**：同 S10（换成 `plugins/command-dir/`），另加 `doc/transcript/`（`cli-2`）。

**验收**：差异检查脚本通过；以上测试全部通过。最后一个提交为 `milestone(3/6): 命令插件完成`。

**分支**：`feat/plugin-dir`。

---

### S12　图形插件 `box`：两种装配各演示一次 → 里程碑 ④

**目标**：规格 §3.4、§4，以及 §6 的两条差异判据。

**要做的事**

1. **草稿**：在 `scratch/box` 上完整实现，覆盖以下内容：
   - 创建与派生 id 查重；
   - `in`、嵌套、`move`、`delete`、`group`，以及拒绝 `ungroup`；
   - 属性处理器：`fill` 和 `label` 各自是一个 undo 单元，以及失败回滚；
   - 序列化输出 `data-kind`；
   - 读回：装了插件时还原为 box，没装时降级为 `g`，子部件不完整时按设计文档处理，重复 id 拒绝整个读入；
   - 删除或移走必要子部件时的保护；
   - 树里的 `(box)` 标注，具体放在哪个插件里按设计文档。
   有缺口时按“插件步骤的通用做法”第 2 条处理。
2. **两个演示提交**，从同一个父提交 `P` 出发，插件目录的内容完全相同：
   - 主线分支：方式 A，新增插件，并且只改组合根这一个装配文件；
   - 演示分支 `demo/box-config`：方式 B，新增同一个插件，只改 `plugins.config.json`（以及依赖元数据）。
   两个提交都跑差异检查脚本；再确认两者的插件目录之间差异为空。
3. 演示分支**推送到远程并保留**（README 里要引用它的提交号）。主线随后再补一个提交，把 box 也加进配置文件，供后面的双装配测试使用。
4. 规格 §6.1 版本 B 的会话：做成输入文件和期望输出。期望输出中对齐的差异沿用 Phase 1 的 V1 偏差，并加注说明。
5. 插件自己的测试能独立运行（用测试替身提供上下文）；补充扩展点清单。

**〔S4 修订〕**：主线在 C_A 之后的提交 C_A2 = `plugins.config.json` 加 box + `cli-1-1b.txt`、`cli-1-1b.runs.json`（两次运行：方式 A 用 `--only @svgframe/plugin-shape-box`，方式 B 用 `--config doc/transcript/configs/box.json`，都**不带** `modified-star`）、`configs/box.json`、期望输出、`doc/transcript/README.md` 加注。期望输出用 `--update cli-1-1b` 生成（需事先同意），**必须逐行手工对照 P1 规格 §6.1B**（设计 §8.3 第 4 小节的表就是对照表）；树的对齐按 V1 为 3/2/8 个空格，规格原文为 2/1/7（偏差 T3）。根 `tests/system/` 加一条“未装插件时降级为 `g`、原样写回 `data-kind`”的测试。关键决定：box 不完整时警告并降级（X6）；涉及 box 的重复 id 拒绝整个读入（T1，`requireUnique`）；标题位于 $\left(x + \tfrac{w}{8},\ y + \tfrac{h}{2} + 5\right)$（X3）；`fill` 的 undo 回显为 `box#n2 fill restored on n2-rect`（X10）。设计见 §8.3。**允许修改**：同 S10（换成 `plugins/shape-box/`），另加 `doc/transcript/`（`cli-1-1b`）和 `tests/system/`（降级测试）。

**验收**：两次差异检查都通过；§6.1B 会话通过；基线会话（禁用新增插件时）仍与 `final` 逐字节一致。最后一个提交为 `milestone(4/6): box 接入`。

**评审点（重）**：合并前发给我。我会核对两个演示提交的 `git diff --name-status` 和三条判据的原始输出。

**分支**：`feat/plugin-box`（方式 A）+ `demo/box-config`（方式 B）。

---

### S13　树标签插件 `modified-star` → 里程碑 ⑤

**目标**：规格 §5。`modified-star` 与 `(box)` 并存、互不感知；新增标签时渲染器和内核的差异为 0。

**要做的事**

1. 按通用做法先草稿、再干净提交。
2. 状态必须封装在标签实例的字段里，不使用模块级变量。
3. 状态机测试：编辑 → 保存 → 再编辑 → `undo` 回到保存点，各分支都要覆盖；新建节点、读入后、`init` 后的行为按设计文档。
4. 两个标签同时出现在一行时，拼接顺序符合设计文档。
5. 把设计文档中 dirty 语义、祖先传播、拼接顺序这三处取舍整理成 ADR。

**〔S4 修订〕**：语义已在设计 ADR-3 定下：dirty = 内容与最近一次 `init`、`read` 或 `save` 成功时不一致（`init` 之后没有 `*`，新建节点立即标 `*`）；不向祖先传播，删除和 z-order 变化只体现在根行；多个标签按注册顺序拼接（`g#n1 (box) *`）。状态机测试按设计 §8.4 的表逐行一条。**允许修改**：同 S10（换成 `plugins/tree-star/`）。

**验收**：差异检查脚本通过（内核和渲染器差异为 0）；禁用全部新增插件时，`tree` 输出与 `final` 逐字节一致。最后一个提交为 `milestone(5/6): 标签完成`。

**分支**：`feat/plugin-tree-star`。

---

### S14　双装配一致性与基线兼容的系统测试

**目标**：规格 §6 中“两种方式共同”那部分的验收，并把它纳入 `npm test`。

**要做的事**

1. 三组会话：
   - Phase 1 §6 的基础会话；
   - §6.1 版本 B 的 box 会话；
   - 包含 `stats` 和 `dir` 的新增命令会话。
2. 每组会话都在两种装配下运行，插件集合、顺序、options、初始文件和运行目录都保持一致，输出逐字节相同；`dir` 使用内容固定的临时目录，日志写在目录之外。
3. 基础兼容：禁用全部新增插件（包括树标签）时，输出与 `final` 的输出逐字节相同。
4. 把这些检查接入 CI。

**〔S4 修订〕另加**：`cli-1` 的 full 双装配组（不带参数 vs `--config plugins.config.json`），它只能在 S13 之后加，因为 S10–S13 每次接入的 C 与 C′ 之间两种装配会短暂不一致；`cli-2` 的期望输出（如 S11 未生成，需同意 `--update cli-2`）；组合根与配置的插件集合、顺序、options 一致性测试；CI 加 `npm run typecheck:scripts`、`npm run baseline`，处理 `actions/checkout@v4`、`actions/setup-node@v4` 的 Node 20 弃用提示。

**允许修改**：测试、会话数据、CI 配置。**不改运行代码**；发现问题时单独开修复 PR。

**验收**：`npm test` 和 CI 全绿。

**分支**：`test/p2-system`。

---

### S15　文档收尾 → 里程碑 ⑥，打 tag `p2`

**目标**：交齐规格 §7 的全部交付物。

**要做的事**

1. `doc/README.md`：
   - 扩展点清单定稿；
   - 两种装配方式的说明与配置文件格式；
   - 重构前后的模块依赖图（PlantUML，并渲染成图片）；
   - ADR 至少 3 条，从设计文档整理而来；
   - `dir` 的适配器说明；
   - A.3 分析与 VSCode 演示（并入 S3 的内容）；
   - 过程记录（含对 AI 建议的检查与修正）；
   - 迭代报告：Phase 1 → Phase 2 的架构对比图；
   - 一致性自查：实际目录与设计是否一致、依赖规则是否被违反，尽量用脚本输出作证据。
2. 重新运行 metrics，生成终版 `docs/metrics/`。
3. 逐条对照规格 §7 的验收清单，在 README 中写出每一项的证据位置。
4. 最后一个提交为 `milestone(6/6): 收尾`。合并后打 tag：`git tag p2 && git push origin p2`。

**〔S4 修订〕另加**：`vscode-svg/doc/analysis.md` §1.4 中“设计文档尚未编写”的说法改为指向 README；README §3 合并 L1–L10、P5a/P5b/P10 与 §1.2.4 的区域表；README §5 记录 K1、K2 的消除；改正 README V1 与 `tests/unit/view/TreeRenderer.test.ts:135` 注释中 `tree n1` “第 18 列”的笔误（实为 19）。

**允许修改**：文档、metrics 产物。〔S4 修订〕即 `doc/`、`docs/metrics/`、`vscode-svg/doc/analysis.md`，以及上述测试注释。

**评审点（重）**：**打 tag 之前**把 README 发给我。tag 一旦打上就不能移动。

**分支**：`docs/p2-final`。

---

### S16　全新 clone 终验（由我来做）

在干净目录中 `git clone` 并检出 `p2`，依次运行：`npm ci`、类型检查、全部测试、三组双装配会话、基线兼容、对 box（A 和 B）与 tree-star 三个提交的差异判据、metrics 复现，并确认 `final` 没有被移动。发现问题时在 tag 之前的修复窗口内处理。如果 tag 已经打了，只能新增提交并在 README 里说明，不能移动 tag。

---

## 3. 每一步开工前，你需要告诉 cc 的最少信息

由于不附提示词，开会话时至少要说清楚四件事：

1. “执行 `doc/spec/phase2-plan.md` 的 **Sx**”；
2. 当前 `main` 的提交号（确认 cc 从最新的主线出发）；
3. 上一步评审里有没有遗留问题需要本步一并处理；
4. 本步结束后，cc 要交给你的东西：PR 链接、测试数、基线比对结果，插件步骤还要附差异检查脚本的输出。

需要我出提示词的时候，告诉我是哪一步就行。我会根据当时 `main` 的实际状态来写。
