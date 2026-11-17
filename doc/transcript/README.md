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

### 预留命名（本步不建文件）

| 输入 | 加入步骤 | 内容 |
|---|---|---|
| `cli-1-1b.txt` | S12 | Phase 1 §6.1 版本 B（`box`）。`final` 不支持 `box`，它的期望输出不来自 `final`，单独说明 |
| `cli-2.txt` | S11 | 含 `stats`、`dir` 的新增命令会话；`dir` 用内容固定的夹具目录。S11 的配置提交只加双装配组（`expected: null`，只比较两次运行），期望输出在 S14 补（设计 §4.7） |

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
