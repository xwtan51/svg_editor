# tree / show / help 与方案（README v3）的偏差

本文件记录实现 `TreeCommand`、`ShowCommand`、`HelpCommand` 时与 README v3 不一致、或 README / 规格没有规定而由实现补充的地方。README 本身不改，等 commands 层完成后统一修订（编号接续 `doc/deviations-commands.md` 的思路，前缀 Q = query）。

| # | 位置 | README v3 / 规格 | 实际实现 | 理由 |
|---|---|---|---|---|
| Q1 | `Command` | `Command` 只声明 `execute` / `recordIn` | `findShape(document, id)`（`no such shape: <id>`）从 `EditCommand` 上移到 `Command`，仍为 `protected`；`EditCommand` 删除自己的那份 | `tree <id>` / `show <id>` 需要同一条 §4.2 错误；上移后错误文案只在一处，避免在 `QueryCommand` 里复制一份。`findContainer` / `checkNewId` 只有编辑命令用，留在 `EditCommand` |
| Q2 | `tree` 的参数 | §3 `tree [id]`；R9 | 0 或 1 个参数，多于 1 个报 `usage: tree [id]`；`show` 恰好 1 个，报 `usage: show <id>`；`help` 不接受参数，报 `usage: help`。`tree svg` / `show svg` 报 `no such shape: svg` | R9；E31（根 `svg` 不是命令目标） |
| Q3 | `help` 的排版放在哪里 | README §1.1 view 只负责 tree / show 的排版；本轮任务要求"三条命令只调用 view 层，自己不做排版" | `tree` / `show` 只调用 `TreeRenderer` / `ShapeDetailRenderer`，命令中没有任何排版；**`help` 的排版写在 `HelpCommand` 里**（两个私有常量 + 一个私有方法，约 15 行） | view 层目前没有 help 的渲染类，本轮不允许修改 `src/view/`。迁移方案见文末"需要其他层新增的方法" |
| Q4 | `help` 的格式（V7） | "按 §3 的四个分类分组列出每条命令的语法与一句说明" | 每组一行标题 `Document:` / `Shape editing:` / `Display:` / `Undo / redo:`，其后每条命令一行 `  <usage>  <summary>`；summary 在整份输出中对齐到同一列（最长 usage + 2）；组按 `CommandCategory.order()` 排序（与注册顺序无关），组内按注册顺序；没有已注册命令的分类不输出标题；组间不空行，没有开头说明行 | 规格只说"显示全部命令与语法"。对齐规则与 V1（最长 + 2）一致。不输出空分类，是因为本轮只注册了编辑类与显示类，输出一个空的 `Document:` 标题没有意义；document / undo 命令注册后自然出现 |
| Q5 | 分类标题文字 | A2 中标题为暂定 | 定为 `Document`、`Shape editing`、`Display`、`Undo / redo`（英文，未改 `CommandCategory`） | 全部输出（回显、错误、usage、summary）都是英文，标题与之一致；规格 §3 的中文小标题是文档用语 |
| Q6 | `canvas` 在 help 中 | 未规定 | 本轮没有改动；提醒：`CanvasCommandParser` 不是 `Command` 子类，必须自行声明 `category = CommandCategory.DOCUMENT`（以及 `usage = "canvas [w] [h]"`、`summary`），否则 help 无法给它分组 | `HelpCommand` 只读 `CommandType` 的静态属性 |
| Q7 | 渲染器实例 | 未规定 | `TreeCommand` / `ShowCommand` 各自持有一个 `private static readonly` 渲染器实例 | 两个渲染器都无状态；不经 `CommandContext` 注入，因为它们没有可替换的实现 |
| Q8 | 已有测试 | `CommandParser.test.ts` 的两条 `CommandRegistry` 测试把注册表固定为"只有 10 条编辑命令" | 改为按组断言：编辑命令按顺序出现且全为 EDIT 类、需要文档；tree / show / help 在 back 之后按顺序出现、为 DISPLAY 类，只有 help 不需要文档；测试注册的 stub 排在最后；另拆出"每个 usage 以命令名开头"（`help` 的 usage 就是命令名本身） | 注册 tree / show / help 后原断言必然失败。改写后不再固定完整清单，另一个 agent 注册 init / read / save / undo 时不必再改这两条测试。**合并时这里可能与另一个分支冲突**（对方很可能也改了同一处） |
| Q9 | help 测试 | 任务要求不写死完整命令列表 | `HelpCommand.test.ts` 的断言全部从 `registry().commandTypes()` 推出：每条 usage 恰好出现一次且以其 summary 结尾、每条命令位于自己分类的标题下、标题顺序符合 `DOCUMENT → EDIT → DISPLAY → HISTORY`、summary 列对齐；另向测试上下文的注册表加入 HISTORY 与 DOCUMENT 两个 stub（先注册 HISTORY），验证排序依据的是分类而不是注册顺序；无文档时用 `new TestContext(null)` 直接执行 | `CommandRunner` 的构造函数总是带一个文档，没有改它（与另一个 agent 共用） |
| Q10 | U5 测试 | §4.3、U5 | `QueryCommand.test.ts`：对 `tree`、`tree <g>`、`tree <leaf>`、`show <leaf>`、`show <g>`、`help` 逐一检查 undo / redo 栈深度与锁不变、文档序列化不变、之后 redo / undo 仍按原顺序工作；io 锁定状态下执行后仍锁定；失败的 `tree r9` / `show r9` / `tree a b` / `help x` 同样不改变历史 | — |

## 需要其他层新增的方法

| 层 | 新增 | 用途 |
|---|---|---|
| view | 新类 `CommandListRenderer`（名字待定）：`render(sections: ReadonlyArray<readonly [title: string, entries: ReadonlyArray<readonly [usage: string, summary: string]>]>): string[]` | 接管 Q3/Q4 的排版（标题行、缩进、summary 对齐列），`HelpCommand` 只负责从注册表按分类取数据。参数只用字符串，**不能**接收 `CommandType` / `CommandCategory`：D3 禁止 view 依赖 commands。加入后 `HelpCommand` 的私有常量 `INDENT` / `GAP` 与 `entry()` 删除 |

model、io 无需新增方法。
