# SVG 编辑器（CLI）

## 架构方案

> 本方案对应规格 `doc/spec/phase_cli_1.md`（下文简称"规格"，章节号如 §4.3 均指该文件）。
> 本阶段范围：§3 命令总表中的全部命令、§4.1–§4.3、§5、§6（版本 A）；§4.4 `box` 与插件加载**不在本阶段实现**，只在「4 变化点假设」中讨论。

### 1 模块划分

#### 1.1 目录与职责

```text
src/
├── cli/        进程入口与终端交互（REPL）
├── app/        应用门面：会话状态 + 一行命令的完整执行流程（Invoker）
├── commands/   命令对象层次、命令行解析、命令注册表、undo/redo 历史
├── view/       显示类命令的文本排版（tree / show）
├── io/         SVG 序列化 / 反序列化、XML 解析适配器（封装 @xmldom/xmldom）、文件系统端口
└── model/      领域模型：图形层次（Composite）、文档、属性、快照、图形工厂
```

| 模块 | 职责 | 不负责 |
|---|---|---|
| `cli` | 启动程序、打印 banner、逐行读 stdin、交互时打印提示符 `svg> `、把每一行原样交给 `app`、把 `app` 返回的输出行写到 stdout | 任何命令语义与任何输入解析（包括注释、空行的判断，均由 `Editor` 处理） |
| `app` | 持有当前会话（当前文档、文件路径、历史）；对一行输入执行"解析 → 运行 → 入历史 → 捕获错误 → 产出输出行"；装配具体依赖（如 `NodeFileSystem`） | 具体命令逻辑、终端 IO |
| `commands` | 把 token 序列变成命令对象；每条命令一个类，封装参数、前置校验、执行、撤销；undo/redo 栈与 io 锁 | 文本排版细节、文件读写细节、图形内部几何 |
| `view` | 把模型排成 §5 规定的文本（树形连接线、列对齐、属性明细） | 修改模型 |
| `io` | `SvgDocument ⇄ SVG 文本`；缺 id 自动补齐与警告；文件系统抽象及 Node 实现（**唯一**允许 `import "node:fs"` 的地方） | 命令语义、undo |
| `model` | 图形与文档的状态和行为：平移、缩放、设置属性、增删子节点、查找、快照/恢复、图形类型注册 | 字符串命令解析、文件、控制台 |

`view` 是相对于脚手架新增的目录（脚手架只有 cli/app/commands/io/model），理由：tree/show 的排版既不属于领域（model 不应知道"`├──`"），也不属于文件 IO；放进 commands 会让命令类同时承担排版，违反单一职责。

#### 1.2 各模块关键类

一类一文件、文件名 = 类名（规格 §2.1）。接口同样一接口一文件。`src/cli/main.ts` 是唯一例外（进程入口脚本，见文件头注释）。

**`src/model/`**

| 类 / 接口 | 一句话职责 |
|---|---|
| `Shape`（抽象） | Composite 的 Component：持有 id、父容器引用、样式与透传属性；声明 `moveBy / scaleBy / setAttribute / summary / snapshot / restore` 等统一操作 |
| `LeafShape`（抽象） | 叶子图形的公共实现：持有一组 `GeometryAttribute`，据角色泛化实现平移、缩放、几何属性设置 |
| `Rect` / `Circle` / `Ellipse` / `Line` | 具体叶子图形：声明自己的几何属性表、可选颜色参数、tree 摘要格式与 move 回显锚点 |
| `Text` | 文字叶子图形：在几何 `x y` 之外持有文本内容 `content` |
| `Group` | Composite 的容器（`<g>`）：持有有序子节点，统一操作递归转发给子孙；`canUngroup()` 钩子默认返回 `true`（复合图形子类覆写为 `false`） |
| `SvgDocument` | 文档根（`<svg>`）：画布尺寸 + 顶层子节点；按 id 查找、文档序遍历、元素计数 |
| `ShapeContainer`（接口） | `Group` 与 `SvgDocument` 共同的"可容纳子图形"协议：`indexOf / insertAt / remove / childList / containerLabel` |
| `ChildList` | 有序子节点列表，插入/移除时同步维护子节点的 `parent` 指针；被 `Group`、`SvgDocument` 组合复用 |
| `CanvasSize` | 画布宽高值对象（正数校验、`800x600` 文本形式） |
| `GeometryAttribute` | 一个具名数值几何属性（如 `width`），绑定一个 `CoordinateRole` |
| `CoordinateRole`（接口） | 几何属性"角色"策略：平移时如何变化、缩放时如何变化、取值约束 |
| `XCoordinate` / `YCoordinate` / `Extent` | 三种角色：x 坐标随 dx 平移、y 坐标随 dy 平移、尺寸不随平移且必须 ≥ 0；三者缩放时都乘 factor |
| `StyleAttributes` | `fill / stroke / stroke-width` 三个公共可选属性的设置、取消、校验与序列化顺序 |
| `ExtraAttributes` | 读入文件时遇到的、白名单外属性的有序透传存储（只读，保证 round-trip） |
| `ShapeMemento` | 一个图形（容器则连同全部子孙）属性状态的不透明快照，供 undo 恢复 |
| `TreePosition` | 值对象：(父容器, 下标)，记录结构性命令的原位置 |
| `ShapeType`（接口） | 图形类型的"类静态侧"契约：类型名、create 参数说明 `ParamSpec[]`、`create(id, params)` |
| `ParamSpec` | 一个 create 参数的说明：名字、是否可选、取值来自属性还是文本内容 |
| `ShapeFactory` | **按名字分派①**：类型名 → `ShapeType`（待重构，见 4.1） |
| `IdSyntax` | id 合法性规则（CLI 新建 id 的字符集校验） |
| `NumberFormat` | 数字的严格解析与统一输出格式（显示与序列化共用） |
| `EditorError` | 用户可见错误（不含 `error:` 前缀的消息），所有"预期内失败"都抛它 |

**`src/io/`**

| 类 / 接口 | 一句话职责 |
|---|---|
| `FileSystem`（接口） | 文件系统端口：`readText(path)` / `writeText(path, text)`，失败抛 `EditorError` |
| `NodeFileSystem` | `FileSystem` 的 Node 实现，全工程唯一 `import "node:fs"` 处 |
| `XmlDomAdapter` | Adapter：调用 `@xmldom/xmldom` 的 `DOMParser` 解析文本，把库的 DOM 树转换成 io 自有的 `XmlElement` 树；库的解析错误转成 `EditorError`；全工程唯一 `import "@xmldom/xmldom"` 处 |
| `XmlElement` | io 自有的 XML 节点结构（与第三方库无关）：标签名、有序属性、子元素、字符数据 |
| `SvgSerializer` | `SvgDocument` → SVG 文本；按 `Shape` 暴露的序列化协议通用遍历，不认识具体图形类；手写字符串拼接，不使用 `@xmldom/xmldom` |
| `SvgImporter` | `XmlElement` 树 → `SvgDocument` + 警告；元素类型经 `ShapeFactory` 构造 |
| `IdAllocator` | 读入时为缺 id / 重复 id 的元素按"标签名+序号"分配新 id 并产生警告 |
| `ImportResult` | 读入结果：文档 + 警告行 |

**`src/view/`**

| 类 | 一句话职责 |
|---|---|
| `TreeRenderer` | 生成 §5.1 结构树：连接线 `├── └── │`、属性列对齐；每行内容取自 `Shape.label()` / `Shape.summary()` |
| `ShapeDetailRenderer` | 生成 §5.2 `show` 明细：标签与父容器行、几何行、样式行、透传属性行 |

**`src/commands/`**

| 类 / 接口 | 一句话职责 |
|---|---|
| `Command`（抽象） | 所有命令的根：`execute(ctx)` 产出结果，`recordIn(history)` 多态钩子；静态属性 `requiresDocument` 默认 `true`（经类静态侧继承给子类，`InitCommand` / `ReadCommand` / `HelpCommand` 覆写为 `false`） |
| `EditCommand`（抽象） | 可撤销命令：`prepare`（只读校验+记快照）/ `apply`（不可失败的变更）/ `undo` / `redo` |
| `DocumentCommand`（抽象） | 文档类命令：成功后在历史上打 io 屏障 |
| `QueryCommand`（抽象） | 显示类命令：只读，不入历史 |
| `HistoryCommand`（抽象） | 历史控制命令（undo/redo）的根：自身不入历史 |
| `InitCommand` / `ReadCommand` / `SaveCommand` / `ResizeCanvasCommand` | 文档类具体命令 |
| `CreateCommand` / `DeleteCommand` / `MoveCommand` / `ScaleCommand` / `SetCommand` / `GroupCommand` / `UngroupCommand` / `AddToCommand` | 编辑类具体命令 |
| `ZOrderCommand`（抽象）、`FrontCommand` / `BackCommand` | z-order 命令：父类实现移位与撤销，子类只给出目标下标 |
| `TreeCommand` / `ShowCommand` / `HelpCommand` / `ShowCanvasCommand` | 显示类具体命令 |
| `UndoCommand` / `RedoCommand` | 历史控制具体命令 |
| `CommandType`（接口） | 命令类的"静态侧"契约：`usage`、`summary`、`category`、`requiresDocument`、`parse(args): Command` |
| `CanvasCommandParser` | `canvas` 的静态侧：无参数产出 `ShowCanvasCommand`，带参数产出 `ResizeCanvasCommand`；它不是 `Command` 子类，自行声明 `requiresDocument = true` |
| `CommandRegistry` | **按名字分派②**：命令名 → `CommandType`（待重构，见 4.2）；也为 `help` 提供有序清单 |
| `CommandParser` | 一行文本 → `CommandLine`：分词、查注册表；**不调用** `parse`（由 `Editor` 在检查 `requiresDocument` 之后调用） |
| `CommandLine` | 值对象：查表得到的 `CommandType` + 剩余参数 `ArgList` |
| `Tokenizer` / `Token` | 分词（双引号、转义）；`Token` 记录是否带引号（用于识别 `in` 关键字） |
| `ArgList` | 参数游标：`nextId() / nextNumber() / nextRaw() / remaining() / expectEnd()`，统一产生 usage 错误 |
| `History` | undo 栈、redo 栈、io 锁标志；`record / markIoBarrier / undo / redo` |
| `CommandContext`（接口） | 命令可见的会话能力：取当前文档、替换文档、文件路径、文件系统、历史、注册表 |
| `CommandResult` | 命令产出的输出行（含 `warning:` 行） |

**`src/app/`**

| 类 | 一句话职责 |
|---|---|
| `Editor` | 门面与 Invoker：`executeLine(line): string[]`；按固定顺序处理一行：跳过注释/空行 → `CommandParser.resolve` → 检查 `CommandType.requiresDocument` → `CommandType.parse` → `execute` → 成功后 `recordIn(history)`；把 `EditorError` 转成 `error: …` 行；`Editor.createDefault()` 装配 `NodeFileSystem` |
| `EditorSession` | `CommandContext` 的实现：当前文档（可无）、默认保存路径、`History`、`FileSystem`、`CommandRegistry` |

**`src/cli/`**

| 文件 / 类 | 一句话职责 |
|---|---|
| `main.ts`（入口脚本，非类） | 创建 `Editor` 与 `Repl` 并启动 |
| `Repl` | readline 循环：打印 banner、TTY 时打印提示符、逐行交给 `Editor`、输出结果、EOF 退出 |

#### 1.3 模块依赖图

```plantuml
@startuml modules
skinparam componentStyle rectangle
skinparam packageStyle folder

package "src/cli" as cli {
  [main.ts]
  [Repl]
}
package "src/app" as app {
  [Editor]
  [EditorSession]
}
package "src/commands" as commands {
  [CommandParser]
  [CommandRegistry]
  [Command hierarchy]
  [History]
}
package "src/view" as view {
  [TreeRenderer]
  [ShapeDetailRenderer]
}
package "src/io" as io {
  [SvgSerializer]
  [SvgImporter]
  [XmlDomAdapter]
  [FileSystem]
  [NodeFileSystem]
}
package "src/model" as model {
  [Shape hierarchy]
  [SvgDocument]
  [ShapeFactory]
  [ShapeMemento]
}
component "@xmldom/xmldom" as xmldom <<external>>

cli ..> app : executeLine()
app ..> commands : 解析 / 运行 / 入历史
app ..> io : 装配 NodeFileSystem
app ..> model : 会话持有 SvgDocument
commands ..> model : 编辑领域对象
commands ..> view : tree / show 排版
commands ..> io : read / save
view ..> model
io ..> model
[XmlDomAdapter] ..> xmldom : 唯一使用者（P1）
@enduml
```

依赖整体是一个分层 DAG：`cli → app → commands → {view, io} → model`，`model` 不依赖任何模块。

---

### 2 设计模式的选择

采用的模式一览：

| # | 模式 | 解决的规格问题 | 主要落点 |
|---|---|---|---|
| 2.1 | **Command**（必需） | §3 命令分类、§4.3 undo/redo 粒度、§2 "命令失败不改变任何状态" | `commands/*`、`History`、`Editor` |
| 2.2 | **Memento** | §4.3 undo 要精确还原（move/scale/set 的浮点值、删除的原位置） | `ShapeMemento`、`TreePosition` |
| 2.3 | **Composite** | §2.1 "容器与叶子统一操作"、§3 delete/move/scale 对容器递归 | `Shape` / `LeafShape` / `Group` |
| 2.4 | **Strategy** | §3 move 只平移位置、scale 同乘位置与尺寸、§4.1 尺寸类属性的取值约束 | `CoordinateRole` 及三种角色 |
| 2.5 | **Simple Factory + Registry** | §2.1 "按名字分派只允许两处"：命令名 → 实现、类型名 → 类 | `CommandRegistry`、`ShapeFactory` |
| 2.6 | **Template Method** | 编辑命令共享"先校验、后变更"骨架；front/back 只有目标下标不同 | `EditCommand.execute`、`ZOrderCommand` |
| 2.7 | **Facade** | 同一内核要服务 CLI 以及未来的 agent / 鼠标通道（§2 "为何以 id 定位"） | `Editor.executeLine` |
| 2.8 | **Adapter** | §3 `read` 要解析外部 SVG（XML）文件；第三方 XML 库的 DOM 接口不应扩散到导入逻辑中 | `XmlDomAdapter`、`XmlElement` |

#### 2.1 Command（必需）

**解决的问题**：§3 把命令分成文档类、编辑类、显示类、撤销重做四类，它们与 undo 栈的关系各不相同（§3 表头、§4.3）；§4.3 要求"一条编辑命令 = 一个 undo 单元"，`group` 这类多步操作整体一个单元；§2 要求"命令失败不改变任何状态"。把每条命令物化为对象，就能把"参数 + 执行 + 撤销 + 如何影响历史"封装在一起。

**参与者对应**

| GoF 角色 | 本工程中的类 |
|---|---|
| Command | `Command`（抽象）及四个分类抽象类 `EditCommand` / `DocumentCommand` / `QueryCommand` / `HistoryCommand` |
| ConcreteCommand | `CreateCommand`、`MoveCommand`、`GroupCommand`… 共 20 个具体命令类（见 1.2） |
| Client（创建命令） | `CommandParser` + `CommandRegistry`（定位命令类）+ 各命令类的静态 `parse`（由 `Editor` 调用） |
| Invoker（触发执行） | `Editor`（同时负责在 `parse` 之前检查 `requiresDocument`） |
| Receiver（被操作者） | `SvgDocument`、`Shape` 及其子类（编辑类）；`EditorSession`（文档类）；`History`（undo/redo） |
| 历史管理（Caretaker） | `History`（持有 `EditCommand` 对象；命令自身持有 `ShapeMemento` / `TreePosition`） |

**哪些命令进 undo 栈、其他类如何处理**——不用 `instanceof` 或 `switch`，而是由命令自己通过多态钩子 `recordIn(history)` 决定：

| 分类 | 命令 | `recordIn(history)` 的实现 | 效果 |
|---|---|---|---|
| 编辑类 `EditCommand` | create、delete、move、scale、set、group、ungroup、addto、front、back | `history.record(this)` | 压入 undo 栈、清空 redo 栈、解除 io 锁 |
| 文档类 `DocumentCommand` | init、read、save、canvas（带参数） | `history.markIoBarrier()` | 清空 undo/redo 两栈并加 io 锁；之后 undo/redo 报 `error: undo not allowed after io command`，直到下一条编辑命令成功 |
| 显示类 `QueryCommand` | tree、show、help、canvas（无参数） | 空实现 | 不入栈，不影响锁（§4.3 "显示类跳过"） |
| 历史控制 `HistoryCommand` | undo、redo | 空实现 | 自身不入栈；在 `execute` 里调 `history.undo()` / `history.redo()` |

`canvas` 一个名字对应两种性质，由 `CanvasCommandParser.parse` 按有无参数产出不同类的命令对象，分类判断在解析期一次完成，执行期没有分支。

**关键协作流程（一行输入的一生）**

```plantuml
@startuml command-flow
actor User
participant Repl
participant Editor
participant CommandParser
participant CommandRegistry
participant "MoveCommand" as Cmd
participant Shape
participant History

User -> Repl : "move c1 30 0"
Repl -> Editor : executeLine(line)
Editor -> Editor : 注释 / 空行？→ 直接返回 []
Editor -> CommandParser : resolve(line)
CommandParser -> CommandRegistry : lookup("move")
CommandRegistry --> CommandParser : MoveCommand (CommandType)
CommandParser --> Editor : CommandLine(MoveCommand, args)
Editor -> Editor : MoveCommand.requiresDocument\n为 true 且无文档 → 抛 no document
Editor -> Cmd : MoveCommand.parse(args)\n参数个数、数字格式
Editor -> Cmd : execute(session)
Cmd -> Cmd : prepare(doc)\n解析 id、校验、记 snapshot
Cmd -> Shape : moveBy(30, 0)
Cmd --> Editor : CommandResult
Editor -> Cmd : recordIn(history)
Cmd -> History : record(this)
Editor --> Repl : ["circle#c1 moved to (130,100)"]

User -> Repl : "undo"
Repl -> Editor : executeLine("undo")
Editor -> History : undo()（经 UndoCommand）
History -> Cmd : undo()
Cmd -> Shape : restore(snapshot)
Editor --> Repl : ["circle#c1 moved back to (100,100)"]
@enduml
```

`Editor` 是唯一捕获 `EditorError` 的地方：任何阶段抛出即输出 `error: <message>`，并且**不调用** `recordIn`。

**undo 具体靠什么恢复状态**——三件东西，**从不用逆运算**（`x + 0.1 - 0.1` 在浮点下不保证等于 `x`）：

1. **属性快照 `ShapeMemento`**（move / scale / set）：`prepare` 阶段调用 `target.snapshot()`；容器的快照是组合的（包含全部子孙的快照），undo 时 `target.restore(memento)` 逐一写回。
2. **结构位置 `TreePosition`**（create / delete / group / ungroup / addto / front / back）：`prepare` 阶段记下相关图形的 (父容器, 下标)，undo 时按记录插回原位。
3. **对象身份保持**：被删除、被移出的 `Shape` 对象由命令对象持有，undo 时把**同一个对象**挂回去，而不是重建。这样 redo 栈或 undo 栈中其他命令持有的对象引用始终有效。

各编辑命令的 `apply` / `undo` 要点：

| 命令 | prepare 记录 | apply | undo |
|---|---|---|---|
| create | 新建的 `Shape`（尚未挂入）、目标容器与末尾下标 | `insertAt` | `remove` |
| delete | 目标对象、`TreePosition` | `remove` | 同一对象 `insertAt` 原下标 |
| move / scale / set | 目标对象、`ShapeMemento` | `moveBy` / `scaleBy` / `setAttribute` | `restore(memento)` |
| group | 成员（按文档序）及各自 `TreePosition`、新 `Group` 对象及其插入位置 | 摘出成员 → 插入新组 → 成员依次追加 | 移除新组 → 成员按 (容器, 下标) 升序插回 |
| ungroup | 容器对象（先检查 `canUngroup()`）、其 `TreePosition`、子节点列表 | 移除容器 → 子节点依次插入原下标处 | 子节点移回容器 → 容器插回原下标 |
| addto | 目标对象、原 `TreePosition` | 摘出 → 追加到目标容器末尾 | 摘出 → 插回原位置 |
| front / back | 目标对象、原下标 | 移到同级末尾 / 开头 | 移回原下标 |

**redo** 就是再次调用 `apply()`（`redo()` 在 `EditCommand` 中有默认实现）。依据是栈的不变式：**某命令被 redo 时，文档状态与它第一次执行前完全相同**（undo 是精确还原，redo 栈在任何新编辑后清空），所以 `prepare` 记录的位置与快照依然有效，无需重新校验。

**group 这类多步操作如何保证是一个 undo 单元**：`group g1 r1 c1 t1` 在内部确实是多步（新建容器、逐个摘出成员、逐个挂入），但这些步骤都在**同一个 `GroupCommand` 对象**的 `apply()` 内完成，历史里只压入这一个对象；对应的 `undo()` 一次性按记录还原全部成员位置并移除新组。同理 `delete` 一个容器（整棵子树一次摘下）、`move`/`scale` 一个容器（递归到所有子孙，快照也是整棵子树）都只是一个命令对象。**规则：History 只接收命令对象，不接收"操作步骤"**，因此不存在"半个单元"。

**命令执行失败时如何保证"不改变任何状态"**——两阶段提交 + 结果后置：

1. **解析阶段纯函数化**：`CommandType.parse` 只做分词结果的语法检查（参数个数、数字格式），不触碰会话。
2. **`prepare` 只读**：`EditCommand.execute` 是模板方法，先调 `prepare(doc)` 完成**全部**语义校验（id 存在、类型合法、取值约束、祖先关系、容器类型……）并记录快照/位置；校验失败抛 `EditorError`，此时尚未写任何状态。
3. **`apply` 不可失败**：`apply` 只做已校验过的内存操作（数组插入删除、数值赋值），不解析、不校验、不做 IO。约束写进代码评审清单，并由"失败原子性"测试覆盖（见 3.3）。
4. **历史后置**：只有 `execute` 正常返回，`Editor` 才调用 `recordIn`；失败命令不入栈、也不解除 io 锁。
5. **文档类命令先算后提交**：`save` 先把文档序列化成完整字符串，再一次 `writeText`，写成功后才更新默认路径并打屏障；`read` 先完成读文件、XML 解析、构建新 `SvgDocument`、补 id，全部成功后才替换会话中的文档。
6. **输出后置**：警告行（如 `warning: assigned id rect1 …`）收集在 `CommandResult` 中，只有命令成功才输出；失败时只输出一行 `error:`。

#### 2.2 Memento

**解决的问题**：§4.3 要求 undo 精确还原；§6 的 `move c1 30 0` → `undo` → `moved back to (100,100)` 必须回到原值。用逆运算（反向平移、除以 factor）在浮点下会累积误差，而且 `set` 的"原来没有该属性"也无法用逆运算表达。

**参与者**：Originator = `Shape`（`snapshot()` / `restore()`）；Memento = `ShapeMemento`（对命令不透明，只能交还给原图形）；Caretaker = `MoveCommand` / `ScaleCommand` / `SetCommand`。结构性信息用值对象 `TreePosition` 记录，由结构性命令持有。

**协作**：`prepare` 时 `memento = target.snapshot()`；undo 时 `target.restore(memento)`。`Group.snapshot()` 递归收集子孙的快照（快照本身也是组合结构），`restore` 递归写回。快照只覆盖**属性状态**，不覆盖子节点列表——结构变化由结构性命令自己负责，二者职责不重叠。

#### 2.3 Composite

**解决的问题**：§2.1 "容器与叶子统一操作：move / scale / set / delete 等命令对 `<g>` 与叶子图形一视同仁"；§3 delete 容器连同子孙、move 容器整体平移、scale 递归到每个子孙；§4.4 未来 box 也是"整体又是一个容器"。

**参与者**：Component = `Shape`；Leaf = `LeafShape` 及 `Rect` / `Circle` / `Ellipse` / `Line` / `Text`；Composite = `Group`。根 `SvgDocument` 不是 `Shape`（没有 id，不能被 move/delete），但与 `Group` 共同实现 `ShapeContainer` 接口，并组合同一个 `ChildList`，所以"挂到根下"与"挂到容器下"走同一套代码。

**协作**：命令只面向 `Shape` 编程，例如 `MoveCommand` 只调用 `target.moveBy(dx, dy)`：叶子按几何角色平移自己的坐标，`Group` 把调用转发给每个子节点。需要"是否容器"的地方（`in`、`addto`、`ungroup`）调用多态方法 `shape.asContainer()`（叶子返回 `null`，`Group` 返回自身），不用 `instanceof`。

#### 2.4 Strategy（几何属性角色）

**解决的问题**：§3 move 是增量平移（只影响位置），scale 是"factor 同乘到图形的全部几何属性（位置与尺寸）"，§4.1 `set` 可改各类型的几何属性。若在每个图形类里手写 `moveBy`，5 个叶子类会重复相同的逻辑；若按属性名 `switch`，则违反 §2.1。

**参与者**：Strategy = `CoordinateRole`（`shift(value, dx, dy)`、`scale(value, f)`、`validate(value)`）；ConcreteStrategy = `XCoordinate`（加 dx）、`YCoordinate`（加 dy）、`Extent`（不平移、要求 ≥ 0）；Context = `GeometryAttribute`。

**协作**：每个叶子类只声明属性表，例如 `Rect` = `[x: X, y: Y, width: Extent, height: Extent]`，`Line` = `[x1: X, y1: Y, x2: X, y2: Y]`。`LeafShape.moveBy` 让每个属性按自己的角色移动；`scaleBy` 统一乘 factor；`setAttribute` 在属性表里按名字找到属性，由角色校验取值。同一张属性表还用来生成 create 参数说明（`ParamSpec`）、`show` 的几何行和序列化的属性顺序，即**单一事实来源**。

#### 2.5 Simple Factory + Registry（按名字分派的两处）

**解决的问题**：§2.1 "按名字分派只允许两处：命令分发（命令名 → 实现）与图形工厂（类型名 → 类），且须在架构方案中标注为待重构"。

**参与者**

- `CommandRegistry`：`Map<string, CommandType>`，在构造函数中硬编码注册 §3 的全部命令；`CommandParser` 是唯一调用方。值是"命令类的静态侧"（类本身满足 `CommandType` 接口：静态 `usage`、`summary`、`category`、`requiresDocument`、`parse`），所以表里放的就是类本身，名副其实的"命令名 → 实现"。
- `ShapeFactory`：`Map<string, ShapeType>`，硬编码注册 `rect / circle / ellipse / line / text / g`。值同样是类本身（静态 `typeName`、`params`、`create`）。调用方有两个：`CreateCommand`（CLI 类型名）和 `SvgImporter`（SVG 标签名）。两条路径共用同一张表，所以"按名字分派"确实只有这一处，而不是 CLI 一处、读文件又一处。未注册名字抛 `unknown shape type: X (is the plugin loaded?)`。

**协作**：`create rect r1 10 20 100 50` → `CreateCommand.prepare` 调 `factory.lookup("rect")` → 得到 `Rect`（`ShapeType`）→ 用 `Rect.params` 把剩余 token 配对成具名原始值 → `Rect.create("r1", params)` 在模型内用属性角色校验并构造。读文件时，`SvgImporter` 用标签名查表，用同一份 `params` 从 XML 属性中取值。

**待重构标注**：两处的注册列表都写死在内核中，新增类型或命令必须改内核代码。重构目标与预留见 4.1、4.2。

#### 2.6 Template Method

**解决的问题**：编辑命令都要遵守"先校验后变更"（§2 错误输出），front/back 只有目标下标不同。

**参与者与协作**

- `EditCommand.execute(ctx)`：`prepare(doc)` → `apply()` → `describe()`，子类只实现这三个钩子和 `undo()`。2.1 的失败原子性由这个固定的骨架保证。
- `ZOrderCommand`：实现"记录原下标 → 移动 → 撤销移回"，子类 `FrontCommand` / `BackCommand` 只覆写 `targetIndex(siblingCount)` 和回显动词。

"是否已有文档"（§4.2 最后一行）**不**放在命令实例的模板方法里：它必须在 `parse` 之前判断（约定补充 R10），而 `parse` 之前还没有命令实例。因此它是类静态侧的声明 `CommandType.requiresDocument`（`Command` 给出默认值 `true`，`InitCommand` / `ReadCommand` / `HelpCommand` 覆写为 `false`），由 `Editor.executeLine` 在固定流程中检查，见 2.1 时序图。

#### 2.7 Facade

**解决的问题**：§2 说明 id 定位是为了让 CLI、agent、鼠标三种通道都能无歧义地指认图形，内核因此不应绑定终端。

**参与者**：Facade = `Editor`，对外只有 `executeLine(line): string[]`（以及 `Editor.createDefault()`）；子系统 = 解析器、注册表、命令、历史、会话。`Repl` 只负责读写终端。转录测试可以直接把 §6 的命令逐行喂给 `Editor`，比对输出，不需要启动子进程。

#### 2.8 Adapter

**解决的问题**：§3 `read` 要把外部 SVG 文件读成文档；§2 要求读入时缺 id 自动补齐并警告。XML 解析本身（实体、CDATA、DOCTYPE、命名空间、属性引号等边界情况）不是本项目的考察点，自己写容易出错，因此改用成熟的 `@xmldom/xmldom`。但它的 W3C DOM 接口（`Node`、`NamedNodeMap`、`childNodes` 的 `nodeType` 判断……）不应扩散到 `SvgImporter` 的导入逻辑中，否则导入代码会与库绑定，换库或升级时要改动所有用到 DOM 的地方。

**参与者**

| GoF 角色 | 本工程中的类 |
|---|---|
| Target（客户期望的接口） | `XmlElement`：io 自有的节点结构（标签名、有序属性、子元素、字符数据） |
| Adaptee（被适配者） | `@xmldom/xmldom` 的 `DOMParser` 及其产出的 DOM `Document` / `Element` |
| Adapter | `XmlDomAdapter`：`parse(text): XmlElement` |
| Client | `SvgImporter`（只认识 `XmlElement`，不 import 库） |

**协作**：`ReadCommand` → `FileSystem.readText` → `XmlDomAdapter.parse(text)`。适配器内部：

1. 以 `image/svg+xml` 模式调用 `DOMParser.parseFromString`，并安装 `onError` 回调：`error` / `fatalError` 级别一律视为解析失败，抛 `EditorError`，由 `ReadCommand` 报 `cannot parse file`（约定补充 F9）；`warning` 级别忽略。**必须安装回调**，否则库默认会写 `console`，违反 P1。
2. 递归把 DOM `Element` 转成 `XmlElement`：标签取 `localName`；属性按 `attributes` 的文档顺序逐个复制（F7、F18 的顺序保留依赖于此）；文本与 CDATA 节点拼成字符数据；注释、处理指令丢弃。
3. 返回根 `XmlElement`。此后 `SvgImporter` 只操作 `XmlElement`，补 id、查 `ShapeFactory`、产生警告等逻辑都与库无关。

**序列化不使用该库**：`SvgSerializer` 仍然手写字符串拼接。约定补充 F18 规定了属性顺序、2 空格缩进、自闭合空容器和统一的数字格式（V3），用库的 `XMLSerializer` 反而难以精确控制这些细节；写出方向的 XML 只需要做转义，不需要库。

**依赖变更（实现阶段执行，本轮只改文档、不执行 `npm install`）**：在 `package.json` 的 `dependencies`（运行时依赖，不是 devDependencies）加入 `@xmldom/xmldom`，版本取安装时的最新稳定版，并由 `package-lock.json` 锁定。该库自带 TypeScript 类型声明，不需要额外的 `@types` 包。换库时只需重写 `XmlDomAdapter` 一个类。

#### 2.9 类图（图形层次 + 命令层次）

```plantuml
@startuml classes
skinparam classAttributeIconSize 0
hide empty members

package model {
  interface ShapeContainer {
    +childList(): Shape[]
    +indexOf(s: Shape): number
    +insertAt(s: Shape, index: number): void
    +remove(s: Shape): number
    +containerLabel(): string
  }
  abstract class Shape {
    -id: string
    -parent: ShapeContainer
    -style: StyleAttributes
    -extras: ExtraAttributes
    +getId(): string
    +{abstract} tagName(): string
    +label(): string
    +{abstract} moveBy(dx: number, dy: number): void
    +{abstract} scaleBy(f: number): void
    +setAttribute(name: string, raw: string): void
    +{abstract} summary(): string
    +{abstract} moveDescription(): string
    +asContainer(): Group
    +isAncestorOf(s: Shape): boolean
    +{abstract} snapshot(): ShapeMemento
    +{abstract} restore(m: ShapeMemento): void
    +{abstract} svgAttributes(): string[][]
  }
  abstract class LeafShape {
    -geometry: GeometryAttribute[]
    +moveBy(dx: number, dy: number): void
    +scaleBy(f: number): void
  }
  class Rect
  class Circle
  class Ellipse
  class Line
  class Text {
    -content: string
  }
  class Group {
    -children: ChildList
    +asContainer(): Group
    +canUngroup(): boolean
  }
  class SvgDocument {
    -size: CanvasSize
    -children: ChildList
    +findById(id: string): Shape
    +elementCount(): number
  }
  class ChildList
  class CanvasSize
  class StyleAttributes
  class ExtraAttributes
  class GeometryAttribute {
    -name: string
    -value: number
    -role: CoordinateRole
  }
  interface CoordinateRole {
    +shift(v: number, dx: number, dy: number): number
    +scale(v: number, f: number): number
    +validate(v: number): void
  }
  class XCoordinate
  class YCoordinate
  class Extent
  class ShapeMemento
  class TreePosition {
    -container: ShapeContainer
    -index: number
  }
  interface ShapeType <<static side>> {
    +typeName: string
    +params: ParamSpec[]
    +create(id: string, params: Map): Shape
  }
  class ParamSpec
  class ShapeFactory <<name dispatch #1, to refactor>> {
    -types: Map<string, ShapeType>
    +lookup(name: string): ShapeType
  }
}

Shape <|-- LeafShape
Shape <|-- Group
LeafShape <|-- Rect
LeafShape <|-- Circle
LeafShape <|-- Ellipse
LeafShape <|-- Line
LeafShape <|-- Text
ShapeContainer <|.. Group
ShapeContainer <|.. SvgDocument
Group *-- ChildList
SvgDocument *-- ChildList
SvgDocument *-- CanvasSize
ChildList o-- "0..*" Shape
Shape --> ShapeContainer : parent
Shape *-- StyleAttributes
Shape *-- ExtraAttributes
LeafShape *-- "1..*" GeometryAttribute
GeometryAttribute --> CoordinateRole
CoordinateRole <|.. XCoordinate
CoordinateRole <|.. YCoordinate
CoordinateRole <|.. Extent
Shape ..> ShapeMemento : creates / restores
ShapeType ..> ParamSpec
ShapeFactory o-- ShapeType
Rect ..|> ShapeType
Circle ..|> ShapeType
Ellipse ..|> ShapeType
Line ..|> ShapeType
Text ..|> ShapeType
Group ..|> ShapeType

package commands {
  abstract class Command {
    +{static} requiresDocument: boolean = true
    +{abstract} execute(ctx: CommandContext): CommandResult
    +{abstract} recordIn(h: History): void
  }
  abstract class EditCommand {
    +execute(ctx: CommandContext): CommandResult
    #{abstract} prepare(doc: SvgDocument): void
    #{abstract} apply(): void
    #{abstract} describe(): string
    +{abstract} undo(): CommandResult
    +redo(): CommandResult
    +recordIn(h: History): void
  }
  abstract class DocumentCommand {
    +recordIn(h: History): void
  }
  abstract class QueryCommand {
    +recordIn(h: History): void
  }
  abstract class HistoryCommand {
    +recordIn(h: History): void
  }
  class CreateCommand
  class DeleteCommand
  class MoveCommand
  class ScaleCommand
  class SetCommand
  class GroupCommand
  class UngroupCommand
  class AddToCommand
  abstract class ZOrderCommand {
    #{abstract} targetIndex(count: number): number
  }
  class FrontCommand
  class BackCommand
  class InitCommand {
    +{static} requiresDocument: boolean = false
  }
  class ReadCommand {
    +{static} requiresDocument: boolean = false
  }
  class SaveCommand
  class ResizeCanvasCommand
  class TreeCommand
  class ShowCommand
  class HelpCommand {
    +{static} requiresDocument: boolean = false
  }
  class ShowCanvasCommand
  class UndoCommand
  class RedoCommand
  class History {
    -undoStack: EditCommand[]
    -redoStack: EditCommand[]
    -ioLocked: boolean
    +record(c: EditCommand): void
    +markIoBarrier(): void
    +undo(): CommandResult
    +redo(): CommandResult
  }
  interface CommandType <<static side>> {
    +usage: string
    +summary: string
    +requiresDocument: boolean
    +parse(args: ArgList): Command
  }
  class CommandRegistry <<name dispatch #2, to refactor>> {
    -types: Map<string, CommandType>
    +lookup(name: string): CommandType
  }
  class CommandParser {
    +resolve(line: string): CommandLine
  }
  class CommandLine {
    -type: CommandType
    -args: ArgList
  }
  interface CommandContext
}

Command <|-- EditCommand
Command <|-- DocumentCommand
Command <|-- QueryCommand
Command <|-- HistoryCommand
EditCommand <|-- CreateCommand
EditCommand <|-- DeleteCommand
EditCommand <|-- MoveCommand
EditCommand <|-- ScaleCommand
EditCommand <|-- SetCommand
EditCommand <|-- GroupCommand
EditCommand <|-- UngroupCommand
EditCommand <|-- AddToCommand
EditCommand <|-- ZOrderCommand
ZOrderCommand <|-- FrontCommand
ZOrderCommand <|-- BackCommand
DocumentCommand <|-- InitCommand
DocumentCommand <|-- ReadCommand
DocumentCommand <|-- SaveCommand
DocumentCommand <|-- ResizeCanvasCommand
QueryCommand <|-- TreeCommand
QueryCommand <|-- ShowCommand
QueryCommand <|-- HelpCommand
QueryCommand <|-- ShowCanvasCommand
HistoryCommand <|-- UndoCommand
HistoryCommand <|-- RedoCommand
History o-- "0..*" EditCommand
CommandRegistry o-- CommandType
CommandParser --> CommandRegistry
CommandParser ..> CommandLine : creates
CommandLine --> CommandType
Command ..|> CommandType : <<static side>>
Command ..> CommandContext
MoveCommand ..> ShapeMemento
ScaleCommand ..> ShapeMemento
SetCommand ..> ShapeMemento
DeleteCommand ..> TreePosition
GroupCommand ..> TreePosition
CreateCommand ..> ShapeFactory
EditCommand ..> Shape : receiver
UngroupCommand ..> Group : canUngroup()
@enduml
```

> 说明：`<<static side>>` 表示该接口由**类的静态成员**满足（TypeScript 结构类型允许把类本身赋给 `ShapeType` / `CommandType` 类型的变量），因此不需要再为每个图形或命令写一个工厂类。

#### 2.10 考虑过但没有采用的模式

| 模式 | 设想用途 | 不采用的理由 |
|---|---|---|
| **Visitor** | 序列化、tree 摘要、计数等操作放在模型外，用 `accept(visitor)` 双分派 | 规格最可能的变化是**新增图形类型**（§4.4 插件、§4.2 "is the plugin loaded?"），而 Visitor 正好让"新增类型"代价最大：每个 Visitor 都要加 `visitBox`，且插件无法修改内核里的 Visitor 接口。改为让 `Shape` 暴露通用的序列化协议（`tagName()` / `svgAttributes()` / `childList()` / 文本内容）与 `summary()`，`SvgSerializer` / `TreeRenderer` 写成通用遍历，新类型只需实现这些方法 |
| **MacroCommand（组合命令）** | 把 group 拆成"新建容器 + N 次移入"的子命令序列，整体入栈 | 子步骤之间互相影响下标，校验必须在任何子步骤执行前完成，拆开反而要处理"做了一半要回滚"；单个 `GroupCommand` 自持全部位置记录更简单。若以后出现"脚本回放 = 一个 undo 单元"之类需求再引入（见 4.6） |
| **整文档快照（粗粒度 Memento）** | 每条编辑命令前克隆整个文档，undo 时整体换回 | 实现最省事、对失败回滚也天然安全，但：①命令的撤销回显（`moved back to …`、`restored into g#markers`）仍需命令级信息；②克隆会破坏对象身份，其他命令持有的引用失效，只能退回按 id 重新查找；③不能体现 Command 自己负责撤销的设计。作为**备选方案**保留：如果 `apply` 不可失败的约束难以守住，可在 `Editor` 加一层整文档快照作为安全网 |
| **Observer** | 文档变更时通知视图刷新 | CLI 是请求-响应式，每条命令的输出由命令自己产出，没有需要被动刷新的订阅者。等 GUI / 鼠标通道（§2）出现再加，`Editor` 门面是自然的挂载点（见 4.3） |
| **Singleton** | `CommandRegistry`、`ShapeFactory`、`History` 全局唯一 | 全局状态妨碍测试隔离（每个测试需要干净的历史）；改为由 `Editor.createDefault()` 构造并注入 |
| **State** | "无文档 / 有文档 / io 锁定"作为编辑器状态对象 | 只有两个布尔维度、规则很少；用 State 会让 20 个命令都面向状态接口分派，过度设计。静态属性 `CommandType.requiresDocument` 加 `History.ioLocked` 已足够 |
| **Interpreter** | 为命令语言建文法与语法树 | 命令语法是扁平的"命令名 + 位置参数 + 可选 `in` 尾缀"，没有嵌套或表达式，分词加 `ArgList` 足够 |
| **Prototype** | 图形工厂按原型克隆出新实例；或 undo 时克隆子树 | create 参数决定全部状态，克隆原型再改属性不比直接构造省事；undo 采用对象身份保持，不需要克隆 |
| **Abstract Factory** | 按"产品族"创建图形 | 只有一个产品族（SVG 图形），没有需要成套替换的维度 |
| **Null Object** | 用 `NoDocument` 代替"当前文档可能为空" | 无文档时规格要求报错（§4.2），空对象会把报错分散到每个方法里；集中在 `Command.run` 检查一次更清楚 |

---

### 3 依赖方向规则

#### 3.1 模块间规则

记号：`X → Y` 表示 X 中的文件可以 `import` Y 中的文件。模块 = `src/` 下的一级目录。

| # | 规则 | 理由 |
|---|---|---|
| D1 | `model` **禁止依赖**任何其他模块 | 领域模型是最稳定的部分，要能脱离 CLI、文件、排版单独测试；未来 GUI / agent 通道也复用它 |
| D2 | `io` **可以依赖** `model`；**禁止依赖** `commands`、`view`、`app`、`cli` | 序列化只需要知道模型；不依赖命令层，换掉命令层不影响文件格式 |
| D3 | `view` **可以依赖** `model`；**禁止依赖** `io`、`commands`、`app`、`cli` | 排版是纯函数式的"模型 → 文本"，不应关心命令或文件 |
| D4 | `commands` **可以依赖** `model`、`view`、`io`；**禁止依赖** `app`、`cli` | 命令是用例，组合领域、排版与 IO；但不能反向知道谁在调用它（Invoker），否则无法被别的通道复用 |
| D5 | `commands` 对 `io` 只能依赖 `FileSystem` **接口**、`SvgSerializer`、`SvgImporter`；**禁止依赖** `NodeFileSystem` | 命令可以在测试中注入内存文件系统；具体实现只由装配层选择 |
| D6 | `app` **可以依赖** `commands`、`model`、`io`；**禁止依赖** `cli`、`view` | `app` 是装配层与 Invoker，需要 `NodeFileSystem` 来装配、需要 `SvgDocument` 类型来持有会话；排版由命令完成，`app` 不直接用 `view` |
| D7 | `cli` **只可以依赖** `app` | 终端层越薄越好；换成别的前端（测试驱动、agent）时只替换 `cli` |
| D8 | 模块间依赖必须无环（上面各条已构成 DAG：`cli → app → commands → {view, io} → model`） | 有环就无法分层测试，也说明职责划分有误 |

#### 3.2 范式与模块内规则

| # | 规则 | 理由 |
|---|---|---|
| P1 | `import "node:fs"` 只允许出现在 `io/NodeFileSystem.ts`；`import "@xmldom/xmldom"` 只允许出现在 `io/XmlDomAdapter.ts`；`node:readline`、`process.stdin/stdout`、`console.*` 只允许出现在 `cli/` | IO 隔离：内核可完全在内存中测试；输出顺序只由 `Editor` 返回值决定；第三方 XML 库被限制在适配器内，换库只改一个类（2.8） |
| P2 | 以字符串为键查找"实现"的 `Map` 只允许出现在 `CommandRegistry` 与 `ShapeFactory` | 规格 §2.1 "按名字分派只允许两处"。按 id 查图形（`SvgDocument.findById`）、按属性名查属性（`LeafShape` 的属性表）查的是**数据**而不是实现，不在此列 |
| P3 | 全工程禁止对图形类型名或命令名使用 `switch` / `if-else` 链；禁止对 `Shape` 的具体子类用 `instanceof`，改用多态方法（如 `asContainer()`） | 规格 §2.1 禁止"到处 switch(tag)"；新增图形类型时不应修改分散的分支 |
| P4 | `Shape`、`LeafShape` 不得在运行时 `import` 自己的子类；具体图形类不得 `import ShapeFactory` | 避免 ESM 循环导入导致 "Class extends value undefined"；工厂依赖具体类，反过来不行 |
| P5 | 一个文件只导出一个类或接口，文件名 = 类名（`main.ts` 例外） | 规格 §2.1 |
| P6 | 字段一律 `private` / `protected`，对外只暴露行为与只读访问器；不导出自由函数 | 规格 §2.1 禁止贫血模型与过程式自由函数 |
| P7 | 抛给用户的错误一律是 `EditorError`；只有 `Editor` 捕获并加 `error:` 前缀 | 错误格式（§2、§4.2）只在一处生成 |

#### 3.3 检查手段

检查手段本身**不新增依赖**（运行时依赖 `@xmldom/xmldom` 是 2.8 的解析需要，与检查无关），采用"自写测试脚本 + 编译器 + 人工抽查"：

1. **架构测试 `tests/unit/architecture.test.ts`**（实现阶段编写，使用已有的 vitest 与 `node:fs`）：
   - 递归列出 `src/**/*.ts`，用正则提取 `import … from "…"` 与 `import type`，把相对路径解析成目标模块，逐条断言 D1–D8；
   - 断言 P1：`node:fs` / `@xmldom/xmldom` / `node:readline` / `console.` / `process.std` 只出现在白名单文件（`@xmldom/xmldom` 的白名单只有 `io/XmlDomAdapter.ts`）；
   - 断言 P2：`Map<string,` 后接 `ShapeType` / `CommandType` 的声明只出现在两个白名单文件；
   - 断言 P3：`src/` 中不出现 `switch (`，不出现 `instanceof (Rect|Circle|Ellipse|Line|Text|Group)`；
   - 断言 P5：每个文件恰好一个 `export class|interface|abstract class`，且名字与文件名一致。
   - 违规即测试失败，`npm test` 会直接暴露"待处理项"。
2. **TypeScript 严格模式**（`npm run typecheck`，已有 `strict`、`noImplicitOverride` 等）：保证覆写关系与空值检查。
3. **失败原子性测试**：对 §4.2 每一种错误场景，执行前后各序列化一次文档并比较，同时检查 undo 栈深度不变。
4. **人工抽查**：每完成一个模块，抽查 2–3 个文件的 import 列表，结果写入「一致性自查」。

**依赖提议（未采纳，仅供讨论）**：`dependency-cruiser`（devDependency）可以用声明式规则更完整地检查依赖与循环，并生成依赖图。本阶段规则只有十余条，自写测试就能覆盖，无需为检查手段再加依赖，所以暂不引入；如果后续模块增多，再提议加入。

---

### 4 变化点假设

按"可能性 × 影响"从高到低排列。

#### 4.1 新增图形类型 / 插件化图形（ShapeProvider）——**待重构 ①：图形工厂**

- **依据**：§3 create 说明"本阶段内核内置六种类型……`box` 为后续插件化阶段的目标"；§4.2 错误信息带 "(is the plugin loaded?)"；§4.4 整节描述 ShapeProvider 插件要做的五件事，并要求"内核为此新增的代码为 0"。§2.1 要求把图形工厂标注为待重构。
- **现状（待重构）**：`ShapeFactory` 在构造函数中硬编码注册六种内置类型，新增类型必须改内核。
- **已预留**：
  - 工厂的值是 `ShapeType` 接口而不是具体类，`ShapeFactory.register(type)` 已存在（内置类型也通过它注册），插件阶段只需从外部调用它；
  - 序列化与显示不使用 Visitor，`SvgSerializer`、`TreeRenderer` 对未知子类通用（2.10）；
  - `Shape.label()`、`Shape.summary()`、`Shape.setAttribute()` 都是可覆写的虚方法，box 可以输出 `box#n1`、`g#n1 (box)`，并实现"fill 传播到 n1-rect"的 set 语义；
  - `Group` 可被继承（box 是容器）；`asContainer()` 是多态的，`in` / `addto` 对 box 自动可用；
  - create 参数由 `ShapeType.params` 描述，usage 文本由它生成，插件类型自带参数 schema；
  - `ungroup` 拒绝复合图形的钩子：`Group.canUngroup()` 默认返回 `true`，`UngroupCommand.prepare` 调用它，返回 `false` 时报 `cannot ungroup composite shape: <id>`（§4.2、§4.4）。本阶段内置类型都返回 `true`，所以这条错误不会触发；box 子类只需覆写这一个方法。**这个钩子的成本几乎为零（一个返回常量的方法加一次调用），所以现在就留**，不必等到插件阶段再改 `UngroupCommand`。
- **决定暂不预留**：插件发现与加载机制（规格本阶段不要求）；`data-kind` 读回还原（需要 `SvgImporter` 在查标签名前先查 `data-kind`，届时改 `SvgImporter` 一处）。理由：这些只有在 box 真正落地时才能确定接口形状，现在预留容易猜错。

#### 4.2 命令集扩展 / 命令由插件提供——**待重构 ②：命令分发**

- **依据**：§2.1 把"命令分发（命令名 → 实现）"列为两处允许的按名分派之一并要求标注待重构；§4.4 box 的 `set n1 label …` 说明命令语义会被插件扩展。
- **现状（待重构）**：`CommandRegistry` 在构造函数中硬编码注册全部命令，新增命令必须改注册表。
- **已预留**：注册表的值是 `CommandType` 接口，`register()` 方法存在；`help` 从注册表生成，新增命令自动出现在帮助里；每个命令一个类，新增命令不改已有命令。
- **暂不预留**：命令别名、插件命令加载、命令名冲突策略——没有规格依据。

#### 4.3 多输入通道：agent / 鼠标 / GUI

- **依据**：§2 "为何以 id 定位"明确提到 CLI / agent / 鼠标三种通道。
- **已预留**：`Editor.executeLine` 门面与终端完全解耦（D7、P1）；命令输出以 `string[]` 返回，而不是直接打印；命令对象可以不经文本解析直接构造（例如鼠标拖拽直接 `new MoveCommand(id, dx, dy)` 交给同一个 Invoker 与 History）。
- **暂不预留**：Observer 式变更通知、结构化（非文本）的命令结果。理由：没有 GUI 时无法验证接口是否合适。

#### 4.4 寻址方式：结构路径（XPath 风格）

- **依据**：§2 "备选的结构路径寻址（如 `/canvas/g1/rect[2]`）本阶段不要求"。
- **已预留**：所有命令解析 id 都经 `SvgDocument.findById` 这一个入口，命令内部持有的是对象引用而不是 id 字符串。将来改成"定位表达式"只需替换这个入口与 `ArgList.nextId()`。
- **暂不预留**：定位器接口（如 `ShapeLocator`）。理由：只有一种寻址方式时，接口只是一层间接。

#### 4.5 undo/redo 与 io 命令的交互规则

- **依据**：§4.3 只说"执行后 undo/redo 禁止……直到下一次编辑命令重新解禁"，没有说明之前的历史是否保留（见约定补充 U2），这条规则很可能会被澄清或修改。
- **已预留**：io 命令对历史的影响集中在 `DocumentCommand.recordIn` → `History.markIoBarrier()` 一处，改成"只锁不清"或"save 不锁"都只动这一处。

#### 4.6 脚本回放与宏

- **依据**：§2 "`#` 开头为注释（便于把命令序列存成脚本回放）"。
- **已预留**：`Editor.executeLine` 逐行处理且自己负责跳过注释和空行（`cli` 不做任何解析），任何行来源（stdin、文件、测试）都可以复用。
- **暂不预留**：`source <file>` 命令、"一个脚本 = 一个 undo 单元"（届时可引入 MacroCommand，见 2.10）。

#### 4.7 SVG 覆盖面扩大（transform、path、polygon、style、更多属性）

- **依据**：§0.1 的示例使用了 `transform="translate(…) scale(…)"`、`text-anchor`、`font-size`，而 §4.1 的白名单不包含它们；真实外部 SVG 几乎都含 `<path>`。
- **已预留**：`ExtraAttributes` 原样透传白名单外的属性，读入后再保存不丢失；新增可编辑属性只需在对应类的属性表中加一项（Strategy 角色可复用）；新元素类型走 4.1 的工厂扩展。
- **暂不预留**：`transform` 的语义（move/scale 改写 transform 还是改写坐标）、不支持元素的透传保留（见约定补充 F6）。理由：需要变换矩阵与包围盒计算，远超本阶段范围。

#### 4.8 文件格式与存储

- **依据**：§2.1 明确允许"IO 未隔离"作为架构层的未模块化，说明 IO 隔离是后续可能被考察的方向。
- **已预留**：`FileSystem` 端口（D5、P1）；序列化与解析是纯字符串转换，不碰文件系统。
- **暂不预留**：多格式编解码接口（如 `DocumentCodec`）。理由：规格只有 SVG，`ReadCommand` / `SaveCommand` 直接用 `SvgImporter` / `SvgSerializer`。

#### 4.9 显示格式（tree / show 的字段与对齐）

- **依据**：§5 只给出示例，没有给出规则；§6.1 与 §5.1 的列对齐不一致（见约定补充 V1），后续很可能被修订。
- **已预留**：每行内容（`summary()`）与整体布局（`TreeRenderer`）分离；对齐规则只在 `TreeRenderer` 一处。

#### 4.10 scale 的语义（基准点）

- **依据**：§3 "factor 同乘到图形的全部几何属性（位置与尺寸）"，即以原点为基准缩放，这对用户不太直观（图形会"跑位"），未来可能改为以图形自身或包围盒中心为基准。
- **已预留**：缩放规则集中在 `CoordinateRole.scale`；改为"以某点为基准"时，给 `scaleBy` 增加一个基准点参数，由角色计算 `p + (v - p) * f`。
- **暂不预留**：包围盒计算。

#### 4.11 明确决定不作为变化点的部分

- **错误信息文本 / 国际化**：§4.2 固定了英文消息，暂不建消息表；消息字面量只出现在抛 `EditorError` 的地方，必要时可以 grep 集中。
- **数字格式精度**：集中在 `NumberFormat` 一处，修改成本本来就低，不另做配置。

---

### 附：约定补充

规格没有定义或定义不清的行为，以下逐条给出决策。编号前缀：R = REPL / 输入，F = 文件与文档，E = 编辑命令，U = undo/redo，V = 显示。

#### R 输入与 REPL

| # | 未定义 / 不清之处 | 决策 | 理由 |
|---|---|---|---|
| R1 | 非交互（stdin 非 TTY，如管道回放脚本）时是否打印提示符 | 仅当 stdin 是 TTY 时打印 `svg> `；非 TTY 时不打印提示符、不回显输入 | 脚本回放与转录测试的输出只含结果行，便于比对；与现有 smoke test（空输入只输出 banner）一致 |
| R2 | 注释如何识别 | 去掉行首空白后以 `#` 开头即为注释，整行忽略、无输出；**行内 `#` 不是注释**；由 `Editor.executeLine` 判断，`cli` 不做任何解析 | 颜色值 `#4a90d9` 以 `#` 开头，行内注释会误伤参数 |
| R3 | 空行 / 纯空白行 | 忽略，无输出；同样由 `Editor.executeLine` 判断 | 脚本可读性 |
| R4 | 命令名大小写 | 区分大小写，只认小写；未知命令报 `error: unknown command: <name>` | 与 id 大小写敏感（§2）一致；规格未给出未知命令的消息，按 §4.2 风格补充 |
| R5 | 引号规则 | 只有以 `"` 开头的 token 是引号 token，延续到下一个未转义的 `"`；引号内支持 `\"` 与 `\\`；闭合引号后必须是空白或行尾；未闭合报 `error: unterminated quote` | §2 只说"双引号包裹"，需要能表达含引号的文字，同时避免类 shell 拼接的复杂性 |
| R6 | 引号是否改变 token 含义 | 引号 token 永远是普通值；只有**未加引号**的 `in` 才被识别为 `in` 子句关键字 | 让 `create text t 0 0 "in"` 这类内容可以表达 |
| R7 | 参数个数不符 | `error: usage: <该命令的语法>`，语法文本与 `help` 中一致（create 按类型给出具体语法） | 规格未定义；复用同一份 usage 文本，避免两处不一致 |
| R8 | 数字格式 | 接受十进制与科学计数法（如 `-1.5`、`.5`、`1e3`），必须有限；拒绝 `0x10`、`Infinity`、`NaN`、空串；报 `error: invalid number: <token>` | `Number()` 过于宽松；§2 "浮点合法"只说明可以是小数 |
| R9 | 多余参数 | 一律视为参数个数不符（R7），包括 `help x`、`undo 3`、`tree a b` | 宁严勿宽，防止静默忽略用户输入 |
| R10 | 同一行有多个错误时报哪一个 | 只报第一个，检查顺序：分词（未闭合引号）→ 未知命令 → 无文档 → 参数语法（个数、数字格式）→ 语义（按参数从左到右：类型、id 合法性、id 是否已存在/不存在、容器关系、取值约束）。实现上与流程一一对应：`CommandParser.resolve` 分词并查表 → `Editor` 检查静态 `CommandType.requiresDocument` → `CommandType.parse` → `execute`（`prepare`），见 2.1 时序图 | §2 "一行一条"；固定顺序便于测试。分词错误排在最前，因为不分词就拿不到命令名 |
| R11 | 无文档时哪些命令可用 | 只有 `init`、`read`、`help`；其余（包括 `undo`、`redo`、`tree`、`canvas`、`save`）报 `no document` | §4.2 "未 read/init 就执行其他命令"按字面执行 |
| R12 | 错误与警告写到哪个流 | 全部写 stdout | 保证与正常输出的相对顺序，转录测试只比对一个流 |
| R13 | 如何退出 | EOF（Ctrl-D）或 Ctrl-C 退出，退出码 0；不新增 `exit` / `quit` 命令 | §3 命令总表没有退出命令，`help` 要显示"全部命令"，不擅自扩充命令集 |
| R14 | 命令出错后进程是否继续 | 继续读下一行；脚本中途出错不终止，退出码仍为 0 | REPL 语义；§6 transcript 中出错后继续执行 |
| R15 | 一行多条命令 | 不支持 `;` 等分隔符，一行一条 | 规格未提及 |

#### F 文档与文件

| # | 未定义 / 不清之处 | 决策 | 理由 |
|---|---|---|---|
| F1 | `init` / `canvas` 只给一个参数 | 只接受 0 个或 2 个参数，1 个时报 usage 错误 | `[w] [h]` 写法有歧义；只给宽度没有明显合理的高度 |
| F2 | 画布尺寸取值 | 必须是正的有限数（可以是小数），否则报 `error: canvas size must be positive` | 零或负尺寸的画布没有意义；§2 浮点合法 |
| F3 | `init` / `canvas` 回显 | `init` → `canvas 800x600 created`（§6）；`canvas` 无参 → `canvas 800x600`；带参 → `canvas resized to 1024x768` | 后两者规格未给出，按 §2 成功反馈风格补充 |
| F4 | 有未保存修改时 `init` / `read` | 直接替换，不提示、不跟踪"脏"状态 | 规格未要求；CLI 没有确认对话机制 |
| F5 | `save` 无参数且文档来自 `init`（没有读入路径） | 报 `error: no file path. use 'save <file.svg>'`；`save x.svg` 成功后，x.svg 成为之后无参 `save` 的默认路径 | §3 只说明从 `read` 读入时的情况；补充"另存为后路径跟随"的常见行为 |
| F6 | 读入不支持的元素（`<path>`、`<polygon>`、`<defs>`、`<title>`、`<use>` 等） | 连同其子树跳过，输出 `warning: skipped unsupported element <path>`；保存时不再写出（**会丢失数据**） | 本阶段只有六种类型，"读入失败"会导致绝大多数真实 SVG 都无法打开；用警告明确告知数据丢失。透传保存需要"不可编辑节点"概念，留到 4.7 |
| F7 | 已支持元素上的白名单外属性（`transform`、`text-anchor`、`font-size`、`style`、`opacity`、`data-*` 等） | 原样保留（`ExtraAttributes`），保存时按原顺序写回，`show` 中列出，不能 `set` | round-trip 不丢信息；§0.1 示例就包含这类属性 |
| F8 | `<g transform>` 与 move / scale 的关系 | `move` / `scale` 一律修改**局部坐标**（容器递归到子孙），不读取、不改写 `transform`；tree / show 显示的是局部坐标 | 理解 transform 需要矩阵运算；§3 "作用于容器时递归到每个子孙"本身就是改子孙坐标的语义 |
| F9 | 读入时根元素不是 `<svg>`，或 XML 格式错误 | `error: cannot parse file: <path>`，原文档与历史不变 | §4.2 只定义了"不存在 / 不可写"两种消息，按同一风格补充 |
| F10 | 读入的画布尺寸 | 取 `width` / `height`（允许 `px` 后缀）；缺失时取 `viewBox` 的宽高；都缺失时用 800×600 并警告 `warning: missing canvas size, using 800x600`；`%`、`mm` 等单位报 `cannot parse file` | 本编辑器坐标系就是 px（§2） |
| F11 | `viewBox` | 保存时总是写 `viewBox="0 0 w h"`，与 width/height 一致；读入的不同 viewBox 不保留 | 模型只有一套 px 坐标系；`canvas` 改尺寸后 viewBox 应随之变化 |
| F12 | 读入时几何属性缺失或非法 | 缺失按 SVG 默认值 0；非数字或尺寸为负报 `cannot parse file: <path>`（附 `invalid value width="50%" on <rect>`） | 缺失是合法 SVG，非法值说明文件不在支持范围内 |
| F13 | 自动补 id 的序号规则 | 先收集文件中所有显式 id；再按文档序给缺 id 的元素分配 `标签名+n`，n 从 1 起，跳过已被占用的名字；每个分配产生一条警告，按文档序输出在汇总行之前 | §2 只给出格式；先收集可以避免分配的 id 与后面的显式 id 冲突 |
| F14 | 文件内 id 重复 | 第一个保留，后续重复者按 F13 规则重新分配，并警告 `warning: duplicate id r1, reassigned to rect2` | §2 要求唯一；与"自动补 id 并警告"同一处理思路，不因可修复的问题拒绝整个文件 |
| F15 | 读入 `<text>` 的内容 | 取全部字符数据拼接后去除首尾空白；内部子元素（如 `<tspan>`）被拍平，并警告 `warning: flattened <tspan> in text#t1` | 模型的 text 只有单一内容 |
| F16 | 读入的 id 字符集 | 读入的 id 不做字符集校验（非空即可）；CLI 新建的 id 必须匹配 `^[A-Za-z_][A-Za-z0-9_.:-]*$`，否则 `error: invalid id: <id>` | 读入要宽容；新建时保证写出的 SVG 合法（XML id 不能以数字开头） |
| F17 | 元素计数口径（`saved to … (N elements)`） | 统计根 `<svg>` 之外的全部图形元素，包含 `<g>`；被跳过的不支持元素不计 | 与 §6 的 5、7、8 三个数字逐一核对一致 |
| F18 | 保存格式 | XML 声明 + 2 空格缩进；属性顺序：`id` → 几何属性（按类型属性表顺序）→ `fill` / `stroke` / `stroke-width` → 透传属性；空容器写成自闭合 `<g id="x"/>`；属性值与文本做 XML 转义（`& < > "`） | 与 §0.1 示例格式一致；固定顺序便于比对 |
| F19 | 保存路径 | 相对路径基于进程当前目录；已存在则覆盖不提示；父目录不存在或无权限 → `cannot write file` | 规格未定义；最小惊讶 |
| F20 | `read` 失败时的警告 | 不输出任何警告，只输出一行 error | §2 "命令失败不改变任何状态"，警告也属于副作用 |
| F21 | 保存空文档 | 允许，`saved to a.svg (0 elements)` | 没有理由拒绝 |

#### E 编辑命令

| # | 未定义 / 不清之处 | 决策 | 理由 |
|---|---|---|---|
| E1 | create 的回显 | 挂在根下：`rect#r1 created`；带 `in`：`rect#r1 created in g#node1` | §4.1、§6 示例 |
| E2 | `in` 子句的识别 | 未加引号的 `in` 出现在倒数第二个 token 时才是子句 | 与 R6 配合，消除与参数值的歧义 |
| E3 | `text` 的内容参数 | 必填；可以是 `""` 空串；单个词可不加引号；`create text` 不接受 fill 参数（创建后用 `set t fill red`） | §4.1 参数表中 text 没有 fill |
| E4 | 几何取值约束 | 坐标类（x、y、cx、cy、x1…）可以是任意有限数（包括负数）；尺寸类（width、height、r、rx、ry）与 `stroke-width` 必须 ≥ 0（允许 0）；违反时报 `error: invalid value for width: -5` | 负尺寸在 SVG 中是错误；0 合法（不渲染） |
| E5 | fill / stroke 的取值校验 | 接受任意非空字符串（包括 `none`、`#abc`、`rgb(…)` 需加引号），不校验颜色语法 | 规格未定义颜色语法，SVG 颜色语法很复杂，校验收益低 |
| E6 | 对 `g` 执行 `set` | 只允许 `fill` / `stroke` / `stroke-width`，设置在 `<g>` 自身（由 SVG 继承作用于子孙）；几何属性与 `text` 报 `unknown attribute` | §2.1 统一操作；`g` 没有几何属性；子孙传播是 box 插件的语义（§4.4），不是普通 `g` 的语义 |
| E7 | `set` 白名单外 / 类型不匹配的属性 | 例如 `set c1 width 3`、`set r1 text x`，报 `error: unknown attribute: width` | §4.1 "白名单外报 unknown attribute"，白名单按类型区分 |
| E8 | `set` 回显 | `rect#r1 updated: x=10`、`rect#r1 updated: fill=red`；text 内容加引号 `text="…"`；undo 回显同格式显示旧值，旧值为"未设置"时显示 `rect#r1 updated: fill unset` | §6 只给出 text 的例子 |
| E9 | 能否删除（取消）某个属性 | 本阶段不支持，`set r1 fill ""` 报 `invalid value for fill` | 规格没有取消属性的语法；undo 已能恢复"未设置"状态 |
| E10 | move 回显的锚点 | 叶子回显 `moved to (锚点)`：rect/text 为 (x,y)，circle/ellipse 为 (cx,cy)，line 为 (x1,y1)；容器回显 `moved by (dx,dy)`（空容器也一样） | §6 只给出 circle 与 g 的例子；锚点按"第一个位置属性"统一 |
| E11 | move undo 回显 | 叶子 `moved back to (原锚点)`；容器 `moved back by (-dx,-dy)` | §6 两个例子 |
| E12 | scale 的基准点与范围 | 以原点 (0,0) 为基准，所有几何属性（坐标与尺寸）同乘 factor；`stroke-width` 与透传属性（如 `font-size`）不变；容器递归 | §3 按字面执行（"同乘到全部几何属性"）；`stroke-width` 不在"几何属性"之列 |
| E13 | scale 的取值 | factor 必须是正的有限数，否则 `scale factor must be positive`（包括 0、负数） | §4.2 |
| E14 | scale 回显 | `rect#r1 scaled by 2`；undo `rect#r1 scaled back by 0.5`（即 1/f，按 V3 格式化）；undo 实际用快照还原，不做除法 | 规格未给出；与 move 的回显形式对称 |
| E15 | delete 回显 | `rect#box deleted`（容器同样）；undo：原父容器是 `g` 时 `rect#box restored into g#markers`，原父为根时 `rect#box restored`；恢复到原下标 | §6 给出了 `restored into` 的形式；根级情况与 create 回显对称 |
| E16 | group 的成员顺序 | 新容器中的成员按它们在**文档中的先后顺序**（前序遍历）排列，而不是参数顺序 | §3 "保持相对顺序"指的是原有相对顺序 |
| E17 | group 新容器放在哪里 | 放进"文档序第一个成员"的原父容器，位置为该成员原来的下标（扣除其前面被一起摘走的同级成员） | 规格未定义；这样单父容器的常见情况下视觉层次变化最小 |
| E18 | group 参数检查 | 至少 1 个成员；成员 id 重复报 `error: duplicate id in arguments: r1`；成员可以来自不同父容器；成员之间有祖先关系时报 `cannot group a container into its own descendant: <祖先 id>`（与 §6 示例一致，报的是容器 id） | §4.2 只覆盖了祖先关系一种 |
| E19 | group 回显 | `g#markers created with 2 children`（§6）；undo：`g#markers removed, 2 children restored` | 后者规格未给出 |
| E20 | ungroup 的目标 | 必须是 `g`，否则 `error: not a container: r1`；`canUngroup()` 返回 `false` 时报 `cannot ungroup composite shape`（本阶段不会触发），该检查排在根级检查之前；根级容器按 §4.2 拒绝（即使是刚 `group` 出来的根级容器也只能 undo） | §4.2 按字面执行；§4.4 中根级 box `n1` 的 `ungroup` 期望得到 composite 错误而不是 top-level 错误，所以 composite 检查要排在前面 |
| E21 | ungroup 容器自身的属性 | 子节点按原顺序插到容器原位置；容器自身的 fill/stroke/透传属性（如 transform）丢弃，若不为空则警告 `warning: attributes of g#g1 discarded: fill, transform` | 子节点外观可能变化，必须告知用户；undo 可完整恢复 |
| E22 | ungroup 空容器 | 允许，效果为删除该容器 | 没有理由拒绝 |
| E23 | ungroup 回显 | `g#g1 ungrouped (2 children promoted)`；undo：`g#g1 regrouped with 2 children` | 规格未给出 |
| E24 | addto 的错误 | 目标容器不存在 → `no such container`；不是 g → `not a container`；图形是目标容器本身或其祖先 → `cannot group a container into its own descendant: <id>` | 与 `in` 子句、group 共用消息 |
| E25 | addto 到已在的同一容器 | 允许，移到末尾 | 与"作为最后一个子节点"的语义一致 |
| E26 | addto 回显 | `rect#r1 added to g#g1`；undo：`rect#r1 moved back into g#x`（原父为根时 `moved back into svg`） | 规格未给出 |
| E27 | front / back 的方向 | front = 同级最后一个（最后绘制、视觉在最上）；back = 同级第一个 | SVG 按文档序绘制 |
| E28 | front / back 回显 | `rect#r1 brought to front` / `rect#r1 sent to back`；undo：`rect#r1 z-order restored` | 规格未给出 |
| E29 | 无实际变化的编辑（`move a 0 0`、set 成相同值、已在最前再 front） | 照常成功、回显、入 undo 栈 | "一条编辑命令 = 一个 undo 单元"（§4.3）规则简单统一 |
| E30 | 被删除图形的 id 能否复用 | 可以；`delete r1` 后可再 `create rect r1 …` | 唯一性只针对当前文档 |
| E31 | 根 `svg` 能否作为命令目标 | 不能（它没有 id）；`svg` 也不是保留字，可以作为普通 id | 规格只把 id 赋给图形元素 |

#### U undo / redo

| # | 未定义 / 不清之处 | 决策 | 理由 |
|---|---|---|---|
| U1 | 栈空 | `error: nothing to undo` / `error: nothing to redo` | 规格未给出 |
| U2 | io 命令之前的历史是否保留 | 成功的 init / read / save / canvas 修改**清空 undo 与 redo 两栈**并加锁；之后的第一条编辑命令解锁，此后只能 undo 到这条命令为止 | init/read 换了文档，旧历史必须作废；save/canvas 采用同一规则，使"io 命令 = 历史屏障"成为一条统一规则（见 4.5、最不确定的决策） |
| U3 | redo 在锁定期间的消息 | 与 undo 相同，按规格字面输出 `error: undo not allowed after io command` | §4.3 写的是 "undo/redo 禁止（报 …）"，只给出这一条消息 |
| U4 | 失败的命令对锁的影响 | 失败的编辑命令不解锁；失败的 io 命令不加锁、不清栈 | §2 "命令失败不改变任何状态"，锁也是状态 |
| U5 | 显示类命令与锁 | tree / show / help / canvas（无参）不影响锁 | §4.3 |
| U6 | undo / redo 的回显 | undo 输出该命令的撤销回显（见 E 各条）；redo 输出与原执行完全相同的回显 | §6 中 `redo` 的输出与 `move` 相同 |
| U7 | 历史深度 | 不限 | 规格未限制，CLI 数据量很小 |
| U8 | 进入锁定状态时、栈本来就空 | 优先报锁定消息，而不是 `nothing to undo` | §6 `save` 之后 `undo` 报锁定消息 |

#### V 显示

| # | 未定义 / 不清之处 | 决策 | 理由 |
|---|---|---|---|
| V1 | tree 的列对齐规则 | 每行"前缀+标签"后补空格，使摘要从同一列开始；列号 = 本次输出中最长的"前缀+标签"宽度 + 2；无摘要的行（g）不补空格。该规则与 §5.1、§6 的示例逐字一致；§6.1 与 §4.4 的示例对齐不规则（同一棵树内列号不同），无法用统一规则复现，以本规则为准 | 规格只有示例；选择与主示例完全吻合的规则 |
| V2 | 各类型的 tree 摘要 | rect：`x= y= w= h=`；circle：`cx= cy= r=`；ellipse：`cx= cy= rx= ry=`；以上三者设置了 fill 时追加 `fill=`；line：`(x1,y1) -> (x2,y2)`；text：`(x,y) "内容"`；g：无摘要；stroke 等样式在 tree 中不显示（见 show） | 逐条取自 §5.1、§6 示例（line 设置了 stroke 也不显示） |
| V3 | 数字输出格式 | 最多 6 位小数，去掉末尾的 0 和小数点，`-0` 输出为 `0`；内部保存全精度，不做舍入；tree、show、回显、保存统一使用 | 避免 `3.0000000000000004` 这类输出；集中在 `NumberFormat` |
| V4 | `tree <id>` 的根行 | 目标图形自身的行没有连接线前缀，其子孙照常缩进；叶子只输出一行 | §4.4 `tree n1` 示例 |
| V5 | 空文档的 tree | 只输出 `svg (800x600)` | 自然推广 |
| V6 | show 的格式 | 第 1 行 `标签  parent=g#x`（根级为 `parent=svg`）；第 2 行几何属性按属性表顺序（text 为 `x= y= text="…"`）；第 3 行已设置的 fill / stroke / stroke-width（都未设置则省略此行）；有透传属性时追加 `other: k=v …` 一行；g 的第 2 行为 `children: a, b`（无子节点为 `children: (none)`） | §5.2 只给出 circle 的例子 |
| V7 | help 的内容 | 按 §3 的四个分类分组列出每条命令的语法与一句说明，内容来自注册表 | §3 "显示全部命令与语法" |
| V8 | 标签格式 | `类型名#id`，类型名取元素标签（`rect`、`g` 等） | §2 成功反馈与 §6 示例 |
| V9 | 非 ASCII 字符的对齐宽度 | 按字符数（UTF-16 码元）计算，不计算东亚字符的显示宽度；id 含中文时 tree 的对齐会有偏差 | 规格的 id 示例均为 ASCII；显示宽度计算需要额外的字符表 |

---

## 过程记录

详见 [process-log.md](process-log.md)。

## 一致性自查

## 质量保证手段

## 修订记录

| 版本 | 日期 | 修改内容 | 原因 |
|---|---|---|---|
| v1 | 2026-10-25 | 初稿：架构方案（模块划分、设计模式、依赖方向规则、变化点假设）与约定补充 | 依据 `doc/spec/phase_cli_1.md` 完成本阶段架构设计 |
| v2 | 2026-10-25 | ① `requiresDocument` 从命令实例的模板方法移到 `CommandType` 静态侧，由 `Editor` 在 `parse` 之前检查，新增 `CommandLine`，同步修改时序图、§2.6、类图与 R10；② 注释、空行统一由 `Editor` 处理，`cli` 不做任何解析；③ 放弃自写 `XmlParser`，改用 `@xmldom/xmldom`，新增 `XmlDomAdapter`（Adapter 模式，新增 §2.8，原 §2.8/§2.9 顺延为 §2.9/§2.10），P1 与架构测试限定只有适配器可以 import 该库，序列化仍手写；④ 预留 `Group.canUngroup()` 钩子，由 `UngroupCommand` 调用 | 审查意见：① R10 与时序图的检查顺序矛盾；② cli 职责与 §1.2、§4.6 的描述矛盾；③ 手写 XML 解析器的边界情况多，不是考察点；④ 钩子成本几乎为零，提前预留比日后修改 `UngroupCommand` 更划算 |
