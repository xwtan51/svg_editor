# src/commands/ 与方案（README v3）的偏差

本文件记录实现 `src/commands/` 时与 README v3 不一致、或 README / 规格没有规定而由实现补充的地方。README 本身不改，等 commands 层完成后统一修订。

## 阶段 A：基础设施

| # | 位置 | README v3 | 实际实现 | 理由 |
|---|---|---|---|---|
| A1 | `CommandType` | `usage / summary / category / requiresDocument / parse` | 另加 `commandName`；`CommandRegistry.register(type)` 用它作键 | 类的静态 `name` 与内置的 `Function.name` 冲突，不能当命令名；与 `ShapeType.typeName` + `ShapeFactory.register(type)` 对称 |
| A2 | `category` 的类型 | 未规定 | 新增值对象类 `CommandCategory`（4 个静态实例 `DOCUMENT / EDIT / DISPLAY / HISTORY`，带标题与排序号）；由 4 个分类抽象类声明静态 `category`，具体命令经静态继承得到 | 避免用字符串表示分类后再比较字符串（P3 的精神）；标题文字（`Document`、`Shape editing`…）是暂定的，`help` 实现时再定 |
| A3 | `CommandContext` | 文档、替换文档、文件路径、文件系统、历史、注册表 | 另加 `shapeFactory()` 与 `hasDocument()` | `create` 要在 `prepare` 中按类型名查 `ShapeFactory`（参数个数取决于类型），工厂需要注入而不是单例（§2.10 Singleton）；`hasDocument()` 供后续 `Editor` 判断 |
| A4 | `EditCommand.prepare` | `prepare(doc)` | `prepare(document, context)` | 同 A3：只有 `CreateCommand` 用到第二个参数；其余子类只声明第一个参数 |
| A5 | `EditCommand` | `prepare / apply / describe / undo` 四个钩子 | 另加可选钩子 `warnings()`（默认空），警告行排在回显之前，redo 时同样输出 | E21 `ungroup` 需要警告；与 `read` 的"警告在汇总行之前"一致；U6 要求 redo 与原执行输出完全相同 |
| A6 | R5 | "闭合引号后必须是空白或行尾"，没有给出报错文案 | `error: unexpected character after closing quote`；引号内除 `\"`、`\\` 外的反斜杠原样保留（引号内的 `\n` 仍是反斜杠加 `n` 两个字符）；未加引号的 token 中的 `"`、`\` 是普通字符 | 规格与 R5 未定义 |
| A7 | `ArgList` | `nextId / nextNumber / nextRaw / remaining / expectEnd` | 另加 `expectCount(n) / expectAtLeast(n) / rest() / takeInClause() / usageError() / usage()` | 各命令的 `parse` 先检查个数、再读数字，保证 R10 "个数先于数字格式"（`move c1 abc` 报 usage 而不是 invalid number）；`in` 子句（E2）的识别集中在一处 |
| A8 | `History` | `record / markIoBarrier / undo / redo` | 另加只读访问器 `undoDepth() / redoDepth() / isLocked()` | §3.3 第 3 点的失败原子性测试要检查栈深度不变 |
| A9 | `CommandParser.resolve` | 未规定空行 | 没有 token 的行视为程序错误（抛普通 `Error`） | 注释与空行由 `Editor` 先过滤（R2、R3），到这里不应出现 |
| A10 | `CommandRegistry` | 构造函数注册全部命令 | 阶段 A 构造函数为空；阶段 B 注册编辑命令；`init / read / save / canvas / tree / show / help / undo / redo` 留给后续步骤；清单方法名为 `commandTypes()` | 按本轮任务划分 |

## 阶段 B：编辑命令

| # | 位置 | README v3 / 规格 | 实际实现 | 理由 |
|---|---|---|---|---|
| B1 | `create` 的检查顺序（R10） | 语法（个数、数字格式）先于语义（类型、id、容器、取值约束） | 类型 → 该类型的参数个数 → id 合法性 → id 是否已存在 → `in` 容器 → 数字格式与取值约束（按参数顺序） | 参数个数取决于类型，必须先查 `ShapeFactory`，所以类型排在个数之前，且都在 `prepare` 中（`parse` 只检查至少有 `<type> <id>`）。数字格式与取值约束合在最后：两者都在 `ShapeType.create` 内部完成，`ParamSpec` 不区分"数字参数"和"字符串参数"，命令层无法提前单独检查数字格式。要完全符合 R10，需要 model 提供 `ParamSpec.isNumeric()`（见文末） |
| B2 | `create` 按类型的 usage（R7） | §4.1 参数表写作 `create rect <id> <x> <y> <w> <h> [fill]` | `usage: create rect <id> <x> <y> <w> <h> [fill] [in <containerId>]`（每种类型都带 `in` 尾缀）；类型或 id 缺失时用通用语法 `usage: create <type> <id> [params…] [in <containerId>]` | §4.1 规定所有类型都支持 `in`；usage 由 `ParamSpec.usageToken()` 生成，`help` 实现时沿用同一文本 |
| B3 | `create` 的 undo 回显 | 未规定 | `rect#r1 removed` | 与 E19 的 `g#markers removed, …` 用词一致 |
| B4 | E2 的推论 | — | 末尾没有容器 id 的 `in` 是普通参数值：`create rect r1 0 0 1 1 in` 成功，fill 为 `in`；`create text t 0 0 in` 的内容为 `in` | E2 按字面执行（只有倒数第二个未加引号的 `in` 才是子句），E5 不校验颜色 |
| B5 | `set` 的校验方式 | `prepare` 只读、`apply` 不可失败 | `prepare`：先取快照 `before` → 试着 `setAttribute`（非法时抛错，模型保证状态不变）→ 再取快照 `after` → `restore(before)`。`apply` 只做 `restore(after)`，undo 做 `restore(before)` | model 只在赋值时校验，没有"只校验不赋值"的方法。这样 `prepare` 结束时文档不变，`apply` 只是写回快照、不会失败，redo 不再解析取值。若 model 提供 `Shape.validateAttribute(name, raw)`，可以去掉这次"试赋值"（见文末） |
| B6 | `set` 回显（E8） | `text="…"` 加引号 | 内容中的 `"` 不转义，原样放在引号里；某属性是"文本内容"还是"属性条目"的判断方式：试赋值后它不在 `geometryEntries()` / `styleEntries()` 中，就是文本内容 | 规格未定义转义；这种判断方式不需要把属性名 `text` 写成字面量与类型名比较（P3 架构测试会把 `=== "text"` 当作类型名分派） |
| B7 | 子节点个数的单复数 | E19、E23 只给出 `2 children` 的例子 | 一律写 `N children`，包括 `with 1 children`、`(0 children promoted)` | 不自行扩充文案规则；如要写成 `1 child`，只需改 `GroupCommand` / `UngroupCommand` 两处 |
| B8 | E17 的"扣除前面被一起摘走的同级成员" | 规定要扣除 | 新组直接放在"文档序第一个成员"原来的下标，不做减法 | 二者等价：与第一个成员同一父容器、下标更小的成员在文档序中必然更靠前，与"第一个"矛盾，所以要扣除的个数恒为 0。代码注释说明了这一点，测试覆盖了不相邻成员（`group n d b` 得到 `a, n, c`）和跨容器成员 |
| B9 | group 的检查顺序（E18、R10） | 未细化 | 新 id（合法性 → 是否已存在）→ 从左到右逐个成员（不存在 → 重复）→ 祖先关系（按参数顺序报第一个"是其他成员祖先"的成员）；新 id 与某成员同名时报 `id already exists` | 按 R10 "从左到右"；祖先关系要拿到全部成员后才能判断，所以排在最后 |
| B10 | group 新建容器的方式 | 未规定 | `GroupCommand` 直接 `new Group(id)`，不经 `ShapeFactory` | group 的语义就是"新建 `g`"，不是按名字选类型；经工厂查 `"g"` 反而多一次按名分派 |
| B11 | ungroup 的"根级"判断 | 未规定 | 容器的父容器就是当前 `SvgDocument` 对象（对象同一性比较） | 不需要 `instanceof`，也不需要给 `ShapeContainer` 加 `isRoot()` |
| B12 | addto 的检查顺序（E24） | 未规定 | 容器（不存在 → 不是 g）→ 图形（不存在）→ 图形是容器本身或其祖先；报错中的 id 是被移动的图形的 id | 按 R10 从左到右；E24 写的是 `<id>` |
| B13 | 引用已有图形时的 id 字符集 | F16 只针对新建 | `ArgList.nextId()` 不做检查；只有 `create` / `group` 的新 id 检查 `IdSyntax`；查找时不合法的 id 自然报 `no such shape` | F16：读入的 id 不受字符集限制，必须能被引用 |
| B14 | `scale` 的检查顺序 | R10：先 id 后取值约束 | `scale nosuch -1` 报 `no such shape`；`-0` 也被拒绝（`scale factor must be positive`） | 按 R10；`-0 > 0` 为假 |
| B15 | 测试 | §3.3 第 3 点：失败原子性测试 | `tests/unit/commands/CommandRunner.ts`（测试专用的 Invoker 替身）提供 `expectRoundTrip`（比较 `SvgSerializer` 输出、每个图形的 `父容器[下标]`、对象同一性，并检查 undo 栈深度 +1）与 `expectRejected`（错误文案逐字一致，序列化、结构、两栈深度、锁状态都不变）；测试专用 `TestContext` 实现 `CommandContext` | `Editor` 尚未实现；用三处人为制造的 undo 错误验证过检查器确实会失败（group 的插回顺序、z-order 的插回下标、move 在 `prepare` 中修改文档） |

## 需要 model 新增的方法

都**不是必需的**，本轮代码没有依赖它们；采纳后可以消除 B1、B5 的绕行写法：

| 方法 | 用途 |
|---|---|
| `ParamSpec.isNumeric(): boolean`（或在 `ShapeType` 上提供"只解析、不构造"的检查） | 让 `CreateCommand` 在 id / 容器检查之前单独检查数字格式，完全符合 R10（B1） |
| `Shape.validateAttribute(name: string, raw: string): void` | 只校验、不赋值；`SetCommand.prepare` 不再需要"试赋值再恢复"（B5） |
