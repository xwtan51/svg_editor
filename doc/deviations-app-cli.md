# src/app/、src/cli/ 与方案（README v4）的偏差

本文件记录实现 `src/app/`（`Editor`、`EditorSession`）与 `src/cli/`（`Repl`、`main.ts`）时，与 README v4 不一致、或 README / 规格没有规定而由实现补充的地方。README 本身不改。

## app

| # | 位置 | README v4 / 规格 | 实际实现 | 理由 |
|---|---|---|---|---|
| C1 | 程序错误（非 `EditorError` 的异常） | 未规定；P7 只规定 `EditorError` 由 `Editor` 加 `error:` 前缀 | `Editor.executeLine` **不捕获**，原样抛出；由 `Repl` 处理（见 C8） | 程序错误说明不变式已被破坏（例如 `apply` 做了一半），文档可能处于半修改状态。若在 `Editor` 里把它当普通错误变成 `error: …` 行，用户会继续编辑、甚至 `save` 一份坏文档；单元测试与转录测试也会把 bug 当成"预期的错误输出"而通过。抛出则测试直接失败 |
| C2 | `Editor` 的构造 | 只提到 `executeLine` 与 `Editor.createDefault()` | 另有公开构造函数 `new Editor(session: EditorSession)`；`createDefault()` 只是用 `NodeFileSystem`、`CommandRegistry`、`ShapeFactory` 构造一个没有文档的会话再调用它 | 测试要注入内存文件系统和预置文档（本分支还没有 `init` / `read`）；与 §2.10 "不用 Singleton、由装配层注入"一致 |
| C3 | `EditorSession` 的构造 | 未规定 | `new EditorSession(files, registry, factory)`；`History` 由会话自己创建；构造时没有文档，预置文档用 `CommandContext.replaceDocument(doc, null)` | 不为测试单独开后门：`replaceDocument` 本来就是 `init` / `read` 要调用的接口 |
| C4 | 无文档时调用 `EditorSession.document()` | `CommandContext` 注释已说明是程序错误 | 抛普通 `Error("no document in this session")`，不是 `EditorError` | `Editor` 在 `parse` 之前已检查 `requiresDocument`；能走到这里说明某条命令声明错了 |
| C5 | `no document` 报错 | §4.2：`error: no document. use 'init' or 'read' first` | 消息字面量写在 `Editor` 里（检查 `requiresDocument` 的地方） | README 只规定了检查的位置（§2.6、R10），没有规定消息放在哪；只有这一处会抛它 |
| C6 | 空行判断 | R3："空行 / 纯空白行" | 用 `String.prototype.trim()` 判断；注释判断为 `trim()` 后以 `#` 开头 | `trim()` 去掉的字符集与 `Tokenizer` 的分隔符 `/\s/` 相同（ECMAScript 的 WhiteSpace + LineTerminator），所以被当成空行的一定是没有 token 的行，不会触发 `CommandParser.resolve` 的"空行是程序错误"（commands A9） |

## cli

| # | 位置 | README v4 / 规格 | 实际实现 | 理由 |
|---|---|---|---|---|
| C7 | `Repl` 的接口 | "readline 循环：打印 banner、TTY 时打印提示符……" | `new Repl(editor, input, output, errors, interactive)`，`run(): Promise<number>` 在结束时给出退出码；是否 TTY 由 `main.ts` 用 `process.stdin.isTTY === true` 判断后传入 | 流和"是否交互"都注入，`Repl` 可以在进程内用内存流测试（包括交互模式的提示符）；`main.ts` 只做装配，把退出码交给 `process.exitCode`（不调用 `process.exit`，保证管道里的 stdout 写完） |
| C8 | 程序错误（接 C1） | R12 "错误与警告全部写 stdout"；R14 "出错后继续" | 写到 **stderr**：`internal error: <stack>`，然后**停止**读入，退出码 **1** | R12、R14 针对的是用户错误（`EditorError`），本条是程序 bug：理由同 C1，继续运行有让用户保存坏文档的风险；写 stderr 使它不混进转录比对的 stdout，非 0 退出码让脚本回放能发现问题 |
| C9 | Ctrl-C（R13） | 退出码 0 | 两条路径都处理：TTY（readline 原始模式）时 readline 发出 `SIGINT` 事件；管道输入时是进程收到的 `SIGINT` 信号（`process.once`，结束时移除）。两者都关闭 readline，`run()` 以 0 结束。停止时已缓冲、尚未处理的行丢弃 | 不处理信号时 Node 默认以 130 退出（测试中实测过：去掉信号处理后该测试失败） |
| C10 | 交互模式的 EOF | 未规定 | Ctrl-D 退出时补一个换行 | 否则 shell 提示符会接在 `svg> ` 后面 |
| C11 | 行尾 | 未规定 | readline 设 `crlfDelay: Infinity`，CRLF 与 LF 等价（行尾的 `\r` 不会进入命令行）；最后一行没有换行也会执行 | Windows 编辑器写出的脚本可以直接回放 |

## 测试

| # | 内容 |
|---|---|
| C12 | `tests/unit/app/`：`EditorSession.test.ts`（6 条）、`Editor.test.ts`（27 条）。R10 逐级验证每一级都用"同时含有下一级错误"的输入（如无文档时 `move c1 abc 0` 报 `no document`）；`requiresDocument = false` 与程序错误两种情况用测试文件内的两个 `QueryCommand` 子类验证（`ping`、`broken`，经 `CommandRegistry.register` 注册）。对 `Editor` 做过两次人为破坏确认测试会失败：把 `parse` 提到文档检查之前（R10 第 3 级失败）、注释判断改为不去行首空白（两条缩进注释用例失败） |
| C13 | `tests/unit/cli/`：`Repl.test.ts`（6 条，进程内、内存流，含交互模式提示符与程序错误）、`main.test.ts`（3 条，子进程、管道输入，含 SIGINT）。**限制**：本分支没有 `init` / `read`，子进程里的会话拿不到文档，所以子进程测试中的命令输出全是错误行；成功的回显由进程内的 `Repl.test.ts` 覆盖（它注入了带文档的 `Editor`）。文档类命令合并后，可以把 `main.test.ts` 换成一段真实会话 |
| C14 | `architecture.test.ts` 末尾追加 1 条："app/、cli/ 被扫描到"（`app/Editor.ts`、`app/EditorSession.ts`、`cli/Repl.ts`、`cli/main.ts`），与 view 的同类断言一样，防止 D6、D7、P1 因目录为空而空转 |
| C15 | `tests/transcripts/` 的运行器（README「质量保证手段」第 1 条的 TODO）**没有写**：它不在本次允许修改的目录内，且 §6 会话需要 `init` / `read` / `save` / `tree` / `undo` 等命令 |

## 需要其他层新增的方法

无。本轮只用到 commands 层已有的 `CommandContext`、`CommandParser.resolve`、`CommandLine.type()/parse()`、`Command.execute/recordIn`、`CommandResult.lines()` 和 `CommandRegistry.register`。

供另外两个分支参考：`static override readonly requiresDocument = false;` 在 `noImplicitOverride` 下可以通过类型检查（测试中的 `ping` 命令就是这样写的），`init` / `read` / `help` 照此覆写即可被 `Editor` 识别。
