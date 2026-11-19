# 基线会话

在动代码之前，把 `final`（`7311723`）的真实 CLI 行为固定下来：之后每一步都用一条命令确认 stdout、stderr、退出码和 `save` 产出的文件与 `final` **逐字节一致**。

会话输入采用规格 `doc/spec/phase_cli_2.md` §6“双装配一致性”的格式：**输入文件只含命令和 `#` 注释**，不含 `svg>` 提示符，也不含输出；期望输出和所需的 SVG 夹具分开存放。

## 目录结构

```
doc/transcript/
├── README.md
├── <会话>.txt                  输入：每行一条命令或 # 注释；UTF-8、LF、以换行结尾、无空行
├── <会话>.runs.json            可选（S9）：这个会话的运行组，见“运行组”
├── configs/…                   运行组用到的插件配置（S9：empty.json）
├── fixtures/<会话>/…           可选：运行前复制进临时工作目录的文件
└── expected/<会话>/            基线（只能由 --update 生成，见“更新规则”）
    ├── stdout.txt              stdout 原样（含 banner）
    ├── exit-code.txt           退出码 + 换行（目前全部为 0）
    └── files/…                 会话结束时工作目录里的每一个文件（夹具 + save 产出）
```

- 会话 = `doc/transcript/` 下（不含子目录）的每个 `*.txt`，按文件名排序运行。
- stderr 不存文件：基线只能从 stderr 为空的运行生成，所以期望的 stderr 恒为空字节串，比对时逐字节检查。
- 工作目录只记录文件，不记录空目录（git 也存不了空目录）。

## 会话清单

| 输入 | 来源 | 行数 | 夹具 | 产出文件 |
|---|---|---|---|---|
| `cli-1.txt` | Phase 1 §6 基础会话；`tests/transcripts/spec-6.txt` 中以 `svg> ` 开头的行去掉前缀。文件名由规格 §6 指定 | 19 | `other.svg`（与 `tests/transcripts/fixtures/other.svg` 逐字节相同） | `demo.svg` |
| `cli-1-1a.txt` | Phase 1 §6.1 版本 A；同样由 `spec-6-1.txt` 转换，4 行 `#` 注释保留为注释 | 18 | 无 | `flowchart.svg` |
| `regression.txt` | 回归补充（规格未要求，见下文） | 165 | `mixed.svg`、`broken.svg` | `out.svg`、`roundtrip.svg` |
| `cli-2.txt` | 规格 §6“双装配一致性”要求的新增命令会话（S11，设计 §4.7 #5）：`stats`、`dir`、`help`。不含 `tree`、`save`，见下文 | 22（含 5 行 `#` 注释） | `.hidden`、`README.md`、`demo.svg`、`package.json`、`docs/readme.txt`、`plugins/keep.txt` | 无（`files/` 与夹具逐字节相同） |
| `cli-1-1b.txt` | Phase 1 §6.1 版本 B（`box`，`doc/spec/phase_cli_1.md` 第 476 行起，S12，设计 §8.3）；规格原文中以 `svg> ` 开头的行去掉前缀，1 行 `#` 注释保留为注释，`$ npm run cli` 与空行不要 | 13（含 1 行 `#` 注释） | 无 | `flowchart-box.svg` |
| `cli-2-star.txt` | 规格 §5 的树（`modified-star` 与 `(box)` 并存，S13，设计 §8.4、§4.7 #6）：`init` → box 与连线 → `group` → `save` → `set n1 fill #f5a623` → `tree`，再 `undo` 回到保存点、`tree` | 11（含 2 行 `#` 注释） | 无 | `flowchart-star.svg` |

`cli-2` 的说明（S11）：

- **运行组**：一组、两次运行，不带参数（方式 A，组合根的全部可选插件）与 `--config {repo}/plugins.config.json`（方式 B），两次都与 `expected/cli-2/` 比较，并且互相比较（设计 §4.7 #5）。所以组合根与 `plugins.config.json` 必须同时含有 `stats`、`dir`：只改一边时，不带参数的那次多出或少了一个命令，基线报差异。
- **期望输出在 S11 经用户同意生成**（2026-11-18）：`npm run baseline -- --update cli-2`（只带 `cli-2` 一个参数，其他会话的基线一个字节都没动），随后逐行对照规格 §2.1、§2.2 与设计 §8.2 手工核对。
- **不含 `tree`、`save`**：`save` 会在工作目录里留下文件，改变之后 `dir` 的列表；`tree` 会在 S13 接入 `modified-star` 后多出 `*`。所以 S12、S13 的接入提交不会让它失配。
- **排序**：`dir` 按 UTF-16 码元排序。夹具特意放了大写开头的 `README.md`：码元顺序是 `.hidden`、`README.md`、`demo.svg`、`package.json`，`localeCompare` 会把 `README.md` 排到最后。夹具里只有小写名字时两种排序结果相同，会话就钉不住排序规则。
- **被忽略的文件会进入 `dir` 的输出**：`SessionRunner` 用 `fs.cpSync` 复制的是**工作区**里的 `fixtures/cli-2/`，不是 git 里的内容。macOS 的 `.DS_Store` 之类被 `.gitignore` 忽略的文件 `git status` 看不到，却会被复制进临时目录、出现在 `dir` 的列表里，使本机比对与 CI 不同，用 `--update` 时还会被写进期望输出。比对或生成之前先确认 `git status --ignored --short doc/transcript/fixtures/cli-2` 没有任何输出（`!!` 是被忽略的文件，`??` 是未跟踪的文件，两者都会被复制）。
- 夹具里没有符号链接（git 与 `cpSync` 在不同平台上处理不一致）；符号链接由插件的真实适配器测试覆盖。

`cli-1-1b` 的说明（S12）：

- **运行组**：一组、两次运行，`--only @svgframe/plugin-shape-box`（方式 A：组合根里只加 box）与 `--config {transcript}/configs/box.json`（方式 B：配置里只有 box，`{ "plugins": [ { "module": "@svgframe/plugin-shape-box" } ] }`），两次都不带 `modified-star`，都与 `expected/cli-1-1b/` 比较，并且互相比较（设计 §4.7、§8.3）。`configs/box.json` 必须放在仓库里：配置里的模块名按配置文件所在位置解析，放到仓库外会报 `error: plugin not found: @svgframe/plugin-shape-box`。
- **期望输出不来自 `final`**：`final` 不支持 `box`。期望输出在 S12 经用户同意生成（2026-11-18）：`npm run baseline -- --update cli-1-1b`（只带 `cli-1-1b` 一个参数，其他会话的基线一个字节都没动），随后逐行对照 Phase 1 规格 §6.1B 与设计 §8.3 第 4 小节的表手工核对。
- **与规格原文的差异只有树里三处摘要前的空格**：规格写的是 2/1/7 个（`rect#n1-rect`、`text#n1-label`、`line#arrow1` 三类行），实际是 3/2/8 个。原因是 Phase 1 的 V1 规则：摘要从整棵树最宽的名字 + 2 列开始（Phase 1 规格 §5 的示例本身就是 3/2/8）。见设计 N4、偏差 T3。其余各行与规格原文逐字相同，banner 是规格里没写出的第一行。

比对输入与规格原文（与上面的“交叉核对”同样的写法；第二条 `diff` 应只列出那 5 行空格不同的树行，第三条把连续空格压成一个后应完全相同）：

```bash
S=doc/spec/phase_cli_1.md; E=doc/transcript/expected/cli-1-1b/stdout.txt
spec() { sed -n '/^\*\*版本 B/,/^版本 A 手工组合/p' "$S" | sed -n '/^```text$/,/^```$/p'; }
printf 'banner: '; head -n 1 "$E"
diff <(spec | grep -E '^(svg> |# )' | sed 's/^svg> //') doc/transcript/cli-1-1b.txt && echo "input:  identical"
diff <(spec | grep -vE '^(svg> |# |\$ |```|$)') <(tail -n +2 "$E")
diff <(spec | grep -vE '^(svg> |# |\$ |```|$)' | tr -s ' ') <(tail -n +2 "$E" | tr -s ' ') && echo "output: identical up to runs of spaces"
```

`cli-2-star` 的说明（S13）：

- **运行组**：一组、两次运行，与 `cli-2` 相同：不带参数（方式 A，组合根的全部可选插件）与 `--config {repo}/plugins.config.json`（方式 B），两次都与 `expected/cli-2-star/` 比较，并且互相比较（设计 §4.7 #6）。
- **期望输出不来自 `final`**：`final` 没有树标签。期望输出在 S13 经用户同意生成（2026-11-19）：`npm run baseline -- --update cli-2-star`（只带 `cli-2-star` 一个参数，其他会话的基线一个字节都没动），随后逐行对照规格 §5、设计 §8.4 与 `cli-1-1b` 的同类回显手工核对。
- **它同时管住了配置**：box 与 `modified-star` 都不贡献命令，通用装配契约测试对它们等于空检查，`cli-1-1b` 的两次运行又都不含 `modified-star`。这个会话的 `tree` 只有在 `plugins.config.json` 含 `modified-star` 时才带 `*`：配置漏了它，`--config` 那次运行的第 8 行变成 `svg (800x600)`，基线报 2 处差异（与期望输出比、与不带参数的那次比）。所以配置改动和这个会话放在同一个提交里（设计 G46）。组合根与配置的一致性测试在 S14 加（设计 §4.9）。
- **与规格 §5 的关系**：stdout 第 8–13 行（第一次 `tree`）与规格 §5 的示例树逐字节相同，包括三处摘要前的 3/2/8 个空格（规格 §5 本身就是按 V1 对齐的，没有 `cli-1-1b` 的 T3 问题）。第 15–20 行是 `undo` 回到保存点之后的同一棵树：填充色回到 box 的缺省值 `#4a90d9`，没有任何 `*`（ADR-3：dirty = 内容与保存点不一致）。

比对第一次 `tree` 与规格 §5 的示例（输出应为空）：

```bash
diff <(awk '/^## 5\./,/^## 6\./' doc/spec/phase_cli_2.md | sed -n '/^```text$/,/^```$/p' | sed '1d;$d') <(sed -n 8,13p doc/transcript/expected/cli-2-star/stdout.txt)
```

### 预留命名

目前没有预留的会话名（原来预留的 `cli-1-1b` 已在 S12 加入，见上表）。

新会话加入时，用 `--update <会话名>` 只生成该会话的基线（需要事先得到明确同意），不得顺带重写已有会话。

## 运行方式

```bash
npm run baseline              # 比对模式（默认）：0 差异时退出码 0，否则 1
npm run baseline -- --update  # 生成模式：重写全部基线 —— 未经明确同意禁止使用
```

脚本在 `scripts/baseline/`（TypeScript，经 tsx 运行；类型检查用 `npm run typecheck:scripts`）。两种模式共用 `SessionRunner`，运行方式完全相同：

1. 在系统临时目录下新建空目录，把 `fixtures/<会话>/` 复制进去；
2. 以该目录为 cwd，直接运行仓库内的 `node_modules/.bin/tsx <CLI 入口的绝对路径> <这次运行的参数…>`，stdin 重定向自输入文件（非 TTY：打印 banner，不打印提示符）。不用 `npm run cli`：npm 会往 stdout 多打 `> svg-editor@0.1.0 cli` 等行，并把 cwd 改回仓库根；
3. 收集 stdout、stderr、退出码，以及目录里剩下的每个文件，然后删除临时目录。

CLI 入口路径只在 `scripts/baseline/BaselinePaths.ts` 的 `CLI_ENTRY` 定义一次（现为 `src/cli/main.ts`）；S5 搬目录时只改这一处。

比对模式逐字节比较 stdout、stderr、退出码和产出文件，规则见下面的“运行组”。最后一行的格式固定为 `baseline: <N> sessions, <M> difference(s) (entry <CLI 入口>; <K> runs)`，退出码 0 当且仅当 M = 0。

## 运行组（`<会话>.runs.json`，S9）

一个会话可以用不同的命令行参数运行多次（设计 §4.7、§4.8）。`doc/transcript/<会话>.runs.json` 声明这些运行：

```json
{
  "groups": [
    {
      "expected": "cli-1",
      "runs": [
        ["--bare"],
        ["--config", "{transcript}/configs/empty.json"]
      ]
    }
  ]
}
```

- `groups`：非空数组，按顺序执行。每组恰好两个键：
  - `expected`：`expected/` 下的目录名（字母或数字开头，只含字母、数字、`.`、`_`、`-`），或 `null`（这组没有期望输出，只比较组内各次运行）；
  - `runs`：非空数组，每一项是一次运行的参数（字符串数组，可以为空数组 `[]`，即不带参数）。
- 参数中的 `{repo}`（仓库根）与 `{transcript}`（本目录）替换成**绝对路径**再交给 CLI：CLI 的 cwd 是临时目录，相对路径会失效。其他 `{…}` 一律视为错误。
- **严格校验**：不是合法 JSON、未知的键、缺少键、`groups` 或 `runs` 为空、参数不是字符串、`expected` 既不是目录名也不是 `null`、未知的占位符，都报 `FAIL <会话>: invalid doc/transcript/<会话>.runs.json: <原因>` 并算作差异；`--update` 时一个文件都不写。
- **缺省**：没有 `.runs.json` 的会话等价于 `{ "groups": [ { "expected": "<会话名>", "runs": [[]] } ] }`，即不带参数运行一次、与 `expected/<会话名>/` 比较。

比对规则（`RunGroup`）：

| 比较 | 何时 | 差异报告 |
|---|---|---|
| 每一次运行 vs `expected/<名字>/` | `expected` 不为 `null` | `FAIL <会话> <参数> vs expected/<名字>: stdout differs at line N`（或 `stderr differs …`、`exit code differs: …`、`file <名字> differs at line N`、`file <名字> only in …`），后附 `diff -u` |
| 组内各次运行两两比较（第 1 与第 2、第 1 与第 3、……） | 总是 | `FAIL <会话> <参数 1> vs <参数 2>: …` |
| `expected/<名字>/` 不存在 | `expected` 不为 `null` | `FAIL <会话>: no baseline expected/<名字> …` |

`<参数>` 是 `.runs.json` 里写的原文（JSON 数组形式，占位符不替换），例如 `["--config","{transcript}/configs/empty.json"]`，所以同一份报告在任何机器上都相同。一组没有差异时打印 `ok   <会话> vs expected/<名字> (<K> runs)`（`expected` 为 `null` 时是 `ok   <会话>: runs agree (<K> runs, no expected output)`）。

另外两类差异：

- **孤儿基线**：`expected/` 下的目录没有被任何会话引用（引用 = 各会话的 `.runs.json` 中出现的 `expected`，没有 `.runs.json` 的会话引用自己的名字）。
- **孤儿运行组**：有 `<名字>.runs.json` 却没有 `<名字>.txt`。

三个已有会话的 `.runs.json` 都是一组、两次运行：`["--bare"]` 与 `["--config", "{transcript}/configs/empty.json"]`（`configs/empty.json` 的内容为 `{ "plugins": [] }`），都与 `final` 的输出比较（设计 §4.7 #1：基础兼容性比较时禁用全部可选插件）。从此不带参数的 full 装配怎样增长都不影响这三个会话。

## 基线生成记录

| 项 | 值 |
|---|---|
| 生成命令 | `npm run baseline -- --update` |
| 生成时的 `src/`、`tests/` | 与 `final`（`7311723`）完全相同（在分支 `chore/p2-setup` 的 `e1911f3` 上生成，该提交只在 `final` 之上新增了 `doc/spec/` 下的文档） |
| 复核 | 另在 `final` 的独立 worktree 中放入同一份 `scripts/` 和 `doc/transcript/`，比对模式 0 差异 |
| 环境 | macOS，Node v26.13.0 |

### 交叉核对（一次性）

§6 与 §6.1A 的基线去掉第一行 banner 后，应与 Phase 1 系统测试数据 `tests/transcripts/` 的期望输出完全一致；输入也应与其中的 `svg> ` 行一致：

```bash
for pair in "spec-6:cli-1" "spec-6-1:cli-1-1a"; do
  src=${pair%%:*}; s=${pair##*:}; T=tests/transcripts/$src.txt; E=doc/transcript/expected/$s/stdout.txt
  echo "== $T <-> doc/transcript/$s.txt + $E"
  printf 'banner: '; head -n 1 "$E"
  diff <(grep '^svg> ' "$T" | sed 's/^svg> //') "doc/transcript/$s.txt" && echo "input:  identical"
  diff <(grep -v '^svg> ' "$T") <(tail -n +2 "$E") && echo "output: identical"
done
```

结果（S0）：两份会话的输入和输出都一致（§6：19 条输入、32 行输出；§6.1A：18 条输入、22 行输出）。非 TTY 下不打印提示符，所以 stdout 就是各条命令输出按顺序的拼接，逐行对齐即等价于逐条命令比对。

## 更新规则

- **以后任何一步都不允许用 `--update` 覆盖基线，除非得到明确同意。** 基线的意义是“与 `final` 一致”；输出变了，先当作回归处理。
- 生成模式只运行 `expected` 不为 `null` 的组，要求：每次运行退出码为 0、stderr 为空；每个 `.runs.json` 合法；写进同一个 `expected/<名字>/` 的各次运行（组内的，以及引用同一名字的其他组的）结果逐字节相同。任何一条不满足，一个文件都不写。

## 回归补充会话 `regression.txt`

规格只要求 §6 基础会话。S6 会把全部命令和图形搬进插件，`help` 的分组和顺序、各条 usage 和报错文案最容易在搬家时悄悄变化，所以加这份会话加强基线。会话用 `#` 注释分成 7 段：无文档、文档命令、create、编辑命令、显示命令、save 与 io 锁、read 往返。

| 命令 | 成功 | 报错 |
|---|---|---|
| `help` | 无文档时、有文档时各一次 | usage（`help extra`） |
| `init` | `init`（缺省 800x600） | usage（`init 1`）、`canvas size must be positive`、`invalid number` |
| `read` | `read mixed.svg`（6 条自动分配 id + 3 条跳过元素的警告）、`read roundtrip.svg`、`read out.svg` | usage、`cannot read file`、`cannot parse file` |
| `save` | `save out.svg`、`save roundtrip.svg`、无参 `save` 写回读入路径 | `no document`、`no file path`、usage、`cannot write file` |
| `canvas` | 查看、改尺寸 | `no document`、usage、`canvas size must be positive` |
| `create` | 六种图形：rect、circle、ellipse、line、text、g；`in` 两层嵌套 | `no document`、usage（无参数、rect 缺参数、text 多给 fill、末尾孤立的 `in`）、`unknown shape type`、`invalid id`、`id already exists`、`no such container`、`not a container` |
| `delete` | 容器（连同子孙）、叶子 | `no document`、usage、`no such shape` |
| `move` | 五种叶子 + 容器 | `no document`、usage、`no such shape` |
| `scale` | 六种图形 | `no document`、usage、`scale factor must be positive`、`invalid number` |
| `set` | fill、stroke、stroke-width、width、x2、r、rx、x、text、`fill none` | `no document`、usage、`unknown attribute`、`invalid value for width` |
| `group` | 两个子元素 | `no document`、usage、`no such shape`、`id already exists`、容器放进自己子孙 |
| `ungroup` | 嵌套容器 | `no document`、usage、`not a container`、`no such shape`、`cannot ungroup top-level container` |
| `addto` | 叶子加入容器 | `no document`、usage、`not a container`、`no such shape`、容器放进自己子孙 |
| `front` / `back` | 各一次 | `no document`、usage、`no such shape` |
| `tree` | 全树（三层嵌套）、`tree grp`（两层）、`tree sub` | `no document`、usage、`no such shape` |
| `show` | 五种叶子 + 两个容器 | `no document`、usage、`no such shape` |
| `undo` | 撤销 move、scale、set、group、addto、ungroup、front、back、delete、create | `no document`、io 锁（`init` 之后、`save` 之后）、usage |
| `redo` | 重做 scale、group | `no document`、io 锁、`nothing to redo`、usage |
| 其他 | `#` 注释（无输出） | `unknown command` |

读入夹具 `mixed.svg`：无 id 的 rect/g/circle/ellipse/line/text、与自动 id 撞名的 `rect1`、只在根元素声明的 `inkscape:` 命名空间前缀、不支持的 `<title>`/`<path>`/`<polygon>`。`broken.svg` 是不完整的 XML。
