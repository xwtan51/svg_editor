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
| A6 | R5 | "闭合引号后必须是空白或行尾"，没有给出报错文案 | `error: unexpected character after closing quote`；引号内除 `\"`、`\\` 外的反斜杠原样保留（`"C:\path"` 得到 `C:\path`）；未加引号的 token 中的 `"`、`\` 是普通字符 | 规格与 R5 未定义 |
| A7 | `ArgList` | `nextId / nextNumber / nextRaw / remaining / expectEnd` | 另加 `expectCount(n) / expectAtLeast(n) / rest() / takeInClause() / usageError() / usage()` | 各命令的 `parse` 先检查个数、再读数字，保证 R10 "个数先于数字格式"（`move c1 abc` 报 usage 而不是 invalid number）；`in` 子句（E2）的识别集中在一处 |
| A8 | `History` | `record / markIoBarrier / undo / redo` | 另加只读访问器 `undoDepth() / redoDepth() / isLocked()` | §3.3 第 3 点的失败原子性测试要检查栈深度不变 |
| A9 | `CommandParser.resolve` | 未规定空行 | 没有 token 的行视为程序错误（抛普通 `Error`） | 注释与空行由 `Editor` 先过滤（R2、R3），到这里不应出现 |
| A10 | `CommandRegistry` | 构造函数注册全部命令 | 阶段 A 构造函数为空；阶段 B 注册编辑命令；`init / read / save / canvas / tree / show / help / undo / redo` 留给后续步骤；清单方法名为 `commandTypes()` | 按本轮任务划分 |
