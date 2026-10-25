# 过程记录

| 日期 | 问题 | 如何发现/确认 | 如何纠正 |
|---|---|---|---|
| 2026-10-25 | 方案 R10 规定"无文档"先于"参数语法"报错，但 §2.1 时序图中参数在 parse 阶段就校验、文档在 run 阶段才检查，实际顺序相反 | 对照约定补充 R10 与命令执行时序图，推演 `move c1 abc 0` 在无文档时的输出 | 把"是否需要文档"移到 CommandType 静态侧，由 Editor 在解析参数前检查 |
| 2026-10-25 | 方案计划自写 XML 解析器（实体、CDATA 等），工作量和出错风险与本作业的重点不符；起因是我给的"不新增依赖"约束 | 评估 io 模块的工作量，对比现成库 | 改用 @xmldom/xmldom，在 io 内用 Adapter 隔离，规则 P1 加入"只有适配器可以 import 它" |
| 2026-10-25 | （正面）agent 在实现 canUngroup 钩子时发现，§4.4 中根级 box 的 ungroup 应报 composite 错误而非 top-level 错误，因此检查顺序必须 composite 在前 | 阅读 v2 diff 中的 E20，对照规格 §4.2、§4.4 确认 | 采纳，写入 E20 |
| 2026-10-25 | 负数尺寸的报错文案把 -1e-9 显示为 0（"invalid value for width: 0"） | 审查 Extent.validate 时想到小负数会被格式化成 -0，写临时测试复现 | 报错改用原值 String(value)，补回归测试 |
| 2026-10-25 | StyleAttributes 用"属性名 → 校验函数"的 Map 加 typeof 判断类型，违反 P2，且与几何属性的设计不一致；架构测试的 P2 检查覆盖不到 | 代码审查，对照 README P2 和 §2.4 | 重构为 StyleProperty 类层次；阶段 C 考虑加强 P2 检查 |
| 2026-10-25 | model 层没有防止结构出错：Group 可以插进自己或自己的子孙（形成环，遍历会无限递归）；public 的 detach() 能绕过 ChildList，让父节点指针和子节点列表不一致 | 审查 ChildList 和 Group 后写临时测试复现，三种情况都被接受 | Group.insertAt 加环检测；架构测试限制只有 ChildList 能调用 attachTo/detach |
| 2026-10-25 | 架构测试的 P5 没检查 export default，默认导出的类可以绕过"文件名 = 类名" | agent 自己的 27 个违规都通过后，我换了 6 种它没想到的写法独立验证，只有这一种没被发现 | P5 拒绝 default 导出，加合成用例 |
| 2026-10-25 | README §2.8 写的流程是 ReadCommand 直接调用 XmlDomAdapter，与依赖规则 D5（commands 只能依赖 FileSystem 接口和 SvgImporter）矛盾 | agent 实现 io 时发现 | 改为由 SvgImporter.read(fs, path) 完成读文件、解析、建模型，README 待更新 |
| 2026-10-25 | 只在根元素上声明的命名空间前缀（如 inkscape:）在读入时被丢掉，save 后再 read 会报 cannot parse file | agent 自测往返时发现 | 导入时把用到的命名空间声明补到使用它的图形上 |
| 2026-10-25 | 带 UTF-8 BOM 的 SVG 文件读入失败 | 我另外喂了 6 种测试里没有的文件，只有 BOM 这一种失败 | 解析前去掉开头的 \uFEFF，补回归测试 |
| 2026-10-25 | 架构测试 D3 在 view 目录为空时"没东西可查所以通过"，实际没有起到检查作用 | view 线 agent 实现时发现 | 追加"view 文件必须被扫描到"的断言，并新增规则：view 不能调用 model 的修改方法 |
| 2026-10-25 | 需要确认 undo 的往返测试真能发现错误 | agent 故意弄坏 3 处 undo（group 插回顺序、z-order 下标、move 在 prepare 中改文档），测试分别失败 5/5/9 个 | 保留这种"故意引入错误"的验证方式，写进质量保证手段 |
| 2026-10-26 | help 的排版写在 HelpCommand 里，没有放进 view 层 | 线 Y agent 汇报偏差 Q3：view 不能依赖 commands（D3），也不允许它新建 view 类 | 接受，作为已知偏差写进 README，标为待重构 |
| 2026-10-26 | 合并文档类命令后，需要确认三条并行线拼起来能复现规格会话 | 用命令层的测试执行器逐条回放 spec-6.txt 和 spec-6-1.txt | 两份会话 0 处不符，第 2 步只需接上 Editor |
| 2026-10-26 | 编辑命令线的测试把注册表写死为"恰好 10 条编辑命令"，两条并行线都要往注册表加命令 | 线 Y 在偏差 Q8 中预告冲突；把 main 合入 feat/doc-commands 时 CommandRegistry.ts 与 CommandParser.test.ts 果然冲突（32e955e），HelpCommand.test 另有一条"文档组为空"的前提失效 | 两边注册都保留；测试改为按组断言，规定不再写死完整命令列表；合并后 742 条全部通过 |
| 2026-10-26 | 编辑命令线按 E2 字面实现，末尾单独的 `in` 被当成 fill / 内容（偏差 B4） | 审查偏差报告时按 B4 的例子推演：漏写容器 id 的命令会静默成功 | 改为报该类型的 usage 错误（偏差 C8，取代 B4），新测试先在修复前的代码上确认不成立 |
| 2026-10-26 | 需要确认 doc-commands、app、cli 三条线的测试真能发现错误 | 各线故意破坏：save 先改路径、read 警告后置；Editor 先 parse 后查文档、注释不去行首空白；Repl 去掉 SIGINT 处理（退出码 130） | 对应测试均失败后恢复，写进质量保证手段 |
| 2026-10-26 | 防空转断言只覆盖了 view、app、cli，commands/ 与 io/ 没有"文件被扫描到"的断言 | 写 README v5 一致性自查时列出全部 toContain 断言 | 记为待办（本次只改文档），README「一致性自查」② |
