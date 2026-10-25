# 文档类与撤销重做命令：与方案（README v4）的偏差

本文件记录实现 `init / read / save / canvas / undo / redo`（分支 `feat/doc-commands`，已合并 PR #7 之后的 main）时，与 README v4 不一致、或 README / 规格没有规定而由实现补充的地方。编号接续 `doc/deviations-commands.md` 的阶段 A、B，记为阶段 C。README 本身不改，等 commands 层全部完成后统一修订。

## 阶段 C：文档类与撤销重做命令

| # | 位置 | README v4 / 规格 | 实际实现 | 理由 |
|---|---|---|---|---|
| C1 | `CanvasCommandParser` 的静态侧 | §1.2 只说它"自行声明 `requiresDocument = true`" | 还要自行声明 `category = CommandCategory.DOCUMENT`，以及 `commandName / usage / summary / parse`，否则不满足 `CommandType` | 它不继承任何命令抽象类，拿不到静态继承的 `category`。`help` 把 `canvas` 列在文档类下，与规格 §3 命令总表一致（无参的 `canvas` 虽然是显示类命令，但命令名只有一个） |
| C2 | 注册方式 | 任务说明把 8 个类都列为"在 `CommandRegistry` 中注册" | 注册了 6 个 `CommandType`：`InitCommand`、`ReadCommand`、`SaveCommand`、`CanvasCommandParser`、`UndoCommand`、`RedoCommand`。`ResizeCanvasCommand` / `ShowCanvasCommand` 不注册，也没有静态侧（`commandName / usage / parse`），只由 `CanvasCommandParser.parse` 构造 | README §2.1："`canvas` 一个名字对应两种性质，由 `CanvasCommandParser.parse` 按有无参数产出不同类的命令对象"。注册表的键是命令名，`canvas` 只能对应一个 `CommandType` |
| C3 | `read` 的警告行 | §1.2：`ImportResult` 是添加 `warning: ` 前缀的唯一地方 | `ImportResult.warnings()` 返回的行已带前缀，所以 `ReadCommand` 用 `CommandResult.of(...warnings, 汇总行)` 拼接，不经过 `CommandResult.withWarnings`（它会再加一次前缀）。结果是 `warning: ` 前缀出现在两个类中：`ImportResult`（read）与 `CommandResult.withWarnings`（编辑命令，偏差 A5） | 不能修改 io。建议 io 提供不带前缀的消息（见文末），由 `CommandResult` 统一加前缀 |
| C4 | `init` / `canvas` 的检查顺序（R10） | 语法先于语义 | `parse`：参数个数（0 或 2，F1）→ 数字格式（R8）；`execute`：正数检查（F2，由 `CanvasSize` 构造函数完成），之后才修改会话或文档。`init abc` 报 usage，`init 0 abc` 报 `invalid number: abc`，`init 0 1` 报 `canvas size must be positive` | 正数是取值约束（语义），与 E4、E13 的位置一致；`parse` 保持纯函数（§2.1 第 1 点） |
| C5 | 元素个数的单复数 | §6 只给出 `5 elements`、`7 elements` | 一律写 `N elements`，包括 `read small.svg (1 elements)`、`saved to a.svg (0 elements)` | 与偏差 B7（`N children`）相同：不自行扩充文案规则 |
| C6 | `read` / `save` 回显中的路径 | 未规定 | 回显用户输入的路径文本；带引号的路径回显时不加引号（`read "my file.svg"` → `read my file.svg (1 elements)`）；不检查扩展名 | 规格未定义；路径原样交给 `FileSystem` |
| C7 | `save` 更新默认路径 | F5："`save x.svg` 成功后，x.svg 成为之后无参 `save` 的默认路径" | 只要写入成功就调用 `setFilePath(path)`，无参 `save` 也会调用（写回原值，没有效果）；写入失败时不调用 | 只有一条路径，没有分支；写入失败时路径不变，由测试覆盖 |
| C8 | `create` 末尾未加引号的 `in`（**取代偏差 B4**） | E2："未加引号的 `in` 出现在倒数第二个 token 时才是子句"；B4 把末尾的 `in` 当作普通值（`create rect q 0 0 1 1 in` 成功，fill 为 `in`） | 最后一个 token 是未加引号的 `in` 时，报该类型的 usage 错误，例如 `usage: create rect <id> <x> <y> <w> <h> [fill] [in <containerId>]`。所有类型都适用：`create text t1 0 0 in` 原来得到内容 `in`，现在报 usage；`create g g1 in in` 原来把 `in` 当作容器 id，现在同样报 usage。带引号的 `"in"` 仍是普通值（R6）。报错位置与参数个数错误相同（偏差 B1：类型之后、id 之前），所以 `create hexagon h1 in` 先报 `unknown shape type` | 按本轮任务要求。末尾的 `in` 几乎一定是漏写了容器 id，静默当作 fill / 内容会掩盖错误；报该类型的 usage 能提示 `in` 后面需要 `<containerId>`。README 的 E2 需要相应补充 |
| C9 | 测试用 Invoker（`tests/unit/commands/CommandRunner.ts`） | — | 在 `parse` 之前检查 `requiresDocument`，与 `Editor` 的固定流程（R10）一致；构造参数可以传入 `null`（无文档）和 `FileSystem`；`expectRejected` 另外检查文档对象和默认路径都没有变化。`TestContext` 改用 `tests/unit/io/MemoryFileSystem.ts`，删去它自带的重复实现 `MapFileSystem` | `read` 失败时不能替换文档或改路径（F20），原有检查只比较序列化内容，"换成内容相同的新文档"发现不了；`init` / `read` 要从无文档开始测 |
| C10 | `CommandRegistry` 的注册顺序 | §3 先列文档类、后列编辑类 | 合并 main（PR #7）后构造函数的顺序为：编辑类 10 条 → `tree, show, help` → 本轮的 `init, read, save, canvas, undo, redo`（追加在末尾，两边的注册都保留） | 按本轮任务要求追加在末尾。`help`（V7）按分类分组，组内保持注册顺序，所以显示顺序不受影响 |
| C11 | 合并 main 时改动的测试 | — | `CommandParser.test.ts` 采用 main 上"按分组检查、不写死完整列表"的写法，补上文档类、撤销重做两组，并检查只有 `init / read / help` 不需要文档（R11）。`HelpCommand.test.ts` 的"按分类而不是注册顺序分组"一条原来断言输出第 1 行就是文档类桩命令，前提是文档类还没有内置命令；现在 `init` 排在最前，改为断言桩命令是文档组的最后一行（组内保持注册顺序），历史桩命令是整个输出的最后一行 | 原断言的意图不变，只去掉"文档组为空"这一前提 |

### 验证

- 合并 main 之前：44 个测试文件、707 条测试全部通过（本轮之前为 38 个文件、621 条）。合并 main（含 PR #7 的 tree / show / help）之后：48 个测试文件、742 条测试全部通过；`npm run typecheck` 无错误；`architecture.test.ts` 未修改，全部通过。
- 人为引入两处错误，确认测试会失败，之后恢复：① `save` 在写文件**之前**更新默认路径（写入失败的 2 条测试失败）；② `read` 把警告行放在汇总行**之后**（read 测试与 §6 场景测试失败）。`in` 修复的新测试在修复前的代码上不成立（原来 `create rect q 0 0 1 1 in` 会成功）。

## 需要其他层新增的方法

都**不是必需的**，本轮代码没有依赖它们：

| 层 | 方法 | 用途 |
|---|---|---|
| io | `ImportResult.messages(): string[]`（不带 `warning: ` 前缀的消息），或者让 `ImportResult` 不再加前缀 | `ReadCommand` 可以改用 `CommandResult.withWarnings`，`warning: ` 前缀只在 `CommandResult` 一处添加（C3） |

`app` 层的 `EditorSession` 需要实现 `CommandContext` 现有的 `replaceDocument(document, path)`：替换文档的同时设置默认路径，`init` 传入 `null`（F5）。这不是新方法，只是提醒：`init` 依赖它把路径清空。

## 建议的 README 修订（commands 层完成后统一处理）

- §1.2 `CanvasCommandParser`：补充"自行声明 `category`"（C1）。
- 约定补充 E2：末尾未加引号的 `in` 报 usage 错误（C8），并删除 B4 的推论。
- §1.2 `ImportResult` 一行：前缀实际也由 `CommandResult.withWarnings` 添加（C3），或者按文末建议改由 `CommandResult` 统一添加。
