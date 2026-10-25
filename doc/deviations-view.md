# src/view/ 实现与方案的偏差

对应 README v3 §1.2 `src/view/` 小节与约定补充 V1、V2、V4、V5、V6、V8。本文件只记录实现时做出的、README 没有写明或与 README 不同的决定，等待审查后再决定是否并入 README。

model 无需新增方法：两个渲染器只用到 `label / summary / asContainer / childList / parentContainer / containerLabel / getId / geometryEntries / styleEntries / extraEntries / textContent / canvasSize`，这些方法都已存在。

## 补充（README 未写明，实现时做的选择）

| # | 位置 | README 原文 | 实现 | 理由 |
|---|---|---|---|---|
| W1 | V1 | 列号 = "本次输出中最长的'前缀+标签'宽度 + 2" | ① 根行 `svg (800x600)` **不参与**列宽计算，也不补空格；② `g` 行虽然不补空格，但**参与**列宽计算（标签很长的 `g` 会把整列往右推） | ① 根行不是图形行，没有"标签 + 摘要"之分；按字面把 `svg (1024x768)` 算进去，只有一个短图形的文档也会被推到很右的列。② 是 V1 原文"最长的前缀+标签"的字面含义。规格的示例都区分不出这两点，测试 `TreeRenderer.test.ts` 中各有一条用例固定下来 |
| W2 | §1.2 view | 只给了类名与职责 | 接口：`TreeRenderer.renderDocument(doc): string[]`（`tree`）、`TreeRenderer.renderSubtree(shape): string[]`（`tree <id>`）、`ShapeDetailRenderer.render(shape): string[]`（`show <id>`），返回输出行，不带换行符 | 与 `Editor.executeLine(): string[]`、`CommandResult` 的"输出行"一致，命令层直接拼进结果 |
| W3 | V4 | "目标图形自身的行没有连接线前缀，其子孙照常缩进" | 子树的第一层子节点从第 0 列开始画连接线（与 `tree` 中根 `svg` 的子节点完全相同），而不是保留它们在整棵文档树中的缩进 | 与 §4.4 `tree n1` 示例一致 |
| W4 | V6 | `children: a, b` | 列出的是直接子节点的 **id**（不是 `rect#a` 这样的标签），按 z-order | 按 V6 原文 |
| W5 | V6 | `text="…"`、`other: k=v …` | text 内容与透传属性的值**原样输出**，不转义、不加引号；值中有空格（如 `transform="translate(10, 0)"`）时 `other:` 行会有歧义 | 规格未定义；show 是给人看的，转义反而难读。如需机器可读，后续再改 |
| W6 | V6 | 未说明 | 对未挂到任何容器上的图形调用 `show` 视为程序错误，抛普通 `Error`（不是 `EditorError`） | 命令层只会对 `findById` 找到的图形调用，找到的图形必定有父容器 |
| W7 | §4.4 | `tree n1` 第一行为 `g#n1 (box)` | 本阶段不实现 box；测试用普通 `g` 搭出同一棵树，第一行是 `g#n1`。"(box)" 这样的类型标注将来应由 `Shape` 提供（例如 `summary()` 或新的钩子），`TreeRenderer` 不需要改 | box 不在本阶段范围（README 开头的范围说明） |

## V1 下 §6.1 与 §4.4 的实际输出

规格中这两处示例的对齐不规则（V1 已说明），按 V1 输出如下，测试中逐字固定：

§6.1 版本 A（最长的"前缀+标签"是 `    │   └── text#process-label`，宽 30，摘要从第 32 列开始）：

```text
svg (800x600)
└── g#flowchart
    ├── g#node1
    │   ├── rect#start          x=120 y=100 w=160 h=60 fill=#4a90d9
    │   └── text#start-label    (155,135) "开始"
    ├── g#node2
    │   ├── rect#process        x=520 y=100 w=160 h=60 fill=#f5a623
    │   └── text#process-label  (545,135) "处理数据"
    └── line#arrow1             (280,130) -> (520,130)
```

§4.4 `tree n1`（n1 为普通 `g`；最长的是 `└── text#n1-label`，宽 16，摘要从第 18 列开始）：

```text
g#n1
├── rect#n1-rect   x=120 y=100 w=160 h=60 fill=#4a90d9
└── text#n1-label  (140,135) "开始"
```

## 架构测试的追加

| # | 内容 | 与 README 的关系 |
|---|---|---|
| W8 | `tests/unit/architecture.test.ts` 末尾追加一组用例：① 断言 `view/TreeRenderer.ts`、`view/ShapeDetailRenderer.ts` 被扫描到，D3 不再是"没有文件、自然通过"；② 新规则：`view/` 中不得调用 model 的变更方法（`moveBy / scaleBy / setAttribute / addExtraAttribute / restore / insertAt / remove / resize / attachTo / detach`）；③ 用合成源码验证该规则能报错 | ② 是 README §1.1"view 不负责修改模型"的检查，§3.2 / §3.3 没有这条规则，并入 README 时需要在 §3.3 补一句。已有规则一条未改 |
| W9 | 架构测试文件头注释第 19 行仍写着 "e.g. view/ today"（view 已有文件，这句已过时） | 按"只允许追加"的约束没有改，留待下次允许修改时一并更正 |
