# svg-editor · 会话常驻规则

Phase 1 已在 tag `final` 交付；Phase 2 按 `doc/spec/phase2-plan.md`（下称“计划”）严格串行推进。每个会话只执行用户指定的那一步（例如“执行 S6”）。

## 固定规则（计划第 1 节）

1. **先读后写**（分级）：
   - **必读**：计划中本步那一节；规格 `doc/spec/phase_cli_2.md` 中与本步相关的章节；设计文档 `doc/design-phase2.md`（S4 之后才有）。
   - **按需读**：分析 `doc/spec/phase2-analysis.md`（仅供参考，不是约束）、`doc/spec/phase_cli_1.md`，以及 `doc/README.md` 里相关的约定补充（R/F/E/V 等编号）。
2. **只做本步范围内的事**：每一步都列出了“允许修改”的目录。超出范围的改动先停下来说明理由，不要顺手改。
3. **设计文档优先**：S4 之后，接口、文案、目录和取舍一律以 `doc/design-phase2.md` 为准。实现时发现设计行不通，**停下来**，先提出对设计文档的修订（写明原因），再继续写代码。
4. **范式约束沿用 Phase 1**：面向对象、一类一文件（文件名 = 类名）、字段封装；不写贫血模型、不写过程式自由函数、不按名字 `switch`。
5. **回归不能断**：每一步结束时 `npm run typecheck` 和 `npm test` 都要全绿；S5 起还要跑 S0 建立的基线会话比对。
6. **偏差要登记**：对规格的任何解释或偏离，都记进设计文档的“约定补充”或“已知偏差”，并给出编号。
7. **过程记录**：每一步结束时，在 `doc/process-log.md` 追加一条：做了什么、AI 提了什么建议、发现了什么问题、怎么确认、怎么修正。
8. **提交方式**：每步一个分支（命名见各步），步骤内可以有多个提交，用 PR 合并到 `main`，**不要 squash**（保留每个提交，方便 `git diff C^ C` 判据）。里程碑步骤的最后一个提交以 `milestone(n/6): …` 开头。
9. **不碰 tag**：不得移动 `final`；`p2` 只在 S15 打。

## 常用命令

```bash
npm run typecheck   # src/ 与 tests/ 的类型检查
npm test            # 全部测试（final 时为 889 个）
npm run baseline    # 基线比对：doc/transcript/ 全部会话与 final 逐字节一致时退出码 0
```

- 基线说明见 `doc/transcript/README.md`；`scripts/` 的类型检查用 `npm run typecheck:scripts`。
- **`npm run baseline -- --update` 会覆盖基线。未经用户明确同意，任何一步都不得使用。** 比对出现差异时按回归处理，而不是更新基线。

## 过程记录格式

`doc/process-log.md` 是一张四列表格：`| 日期 | 问题 | 如何发现/确认 | 如何纠正 |`。新条目追加为表格末尾的新行，保持原格式，不要另起标题、列表或其他格式。

## 技术注意事项

- Node ≥ 22，ESM（`"type": "module"`，`module`/`moduleResolution` 为 NodeNext，相对 import 写 `.js` 后缀）。
- TypeScript 是 7.x：`typescript` 包只有 `unstable/*` 接口，没有 5.x 的 Compiler API。需要解析 TS 源码时，先验证可行再选方案。
- Phase 1 的范式约束由 `tests/unit/architecture.test.ts` 强制执行（`doc/README.md` §3 的 P2、P3、P5 等）：一类一文件、文件名 = 类名、不用 default export、不按名字 `switch`。

## 禁止事项

- 不移动或删除 tag `final`；`p2` 只在 S15 打。
- 不 `git push --force`。
- PR 不 squash。
- 不修改 `tests/transcripts/`：那是 Phase 1 系统测试的数据。
