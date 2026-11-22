# svg_editor

命令行 SVG 编辑器（课程作业）：在 REPL 中用命令创建、编辑、组合图形，读写 SVG 文件，支持 undo / redo。

## 运行

需要 Node.js 22 或更高版本。

```bash
npm ci
```

```bash
npm run cli
```

```bash
npm test
```

`npm ci` 按 `package-lock.json` 安装依赖；`npm run cli` 启动编辑器（输入 `help` 查看全部命令，Ctrl-D 退出）；`npm test` 运行全部测试。另有 `npm run typecheck`、`npm run typecheck:scripts` 做类型检查，`npm run baseline` 做基线比对。

`npm run cli` 后面加 `--` 再写启动参数，决定装哪些插件（三者互斥）：

| 命令 | 装配 |
|---|---|
| `npm run cli` | 不带参数 = full：内置能力 + 代码里列出的全部可选插件（`stats`、`dir`、`box`、`modified-star`） |
| `npm run cli -- --bare` | 只有内置能力：Phase 1 的命令与图形 |
| `npm run cli -- --only <包名>` | 内置能力 + 代码里列出的插件中指定的那些（可重复，例如 `--only @svgframe/plugin-shape-box`） |
| `npm run cli -- --config <文件>` | 内置能力 + 配置文件里启用的插件（例如 `--config plugins.config.json`） |

参数写错时，stderr 输出用法行，退出码 2。

## 文档

- [doc/README.md](doc/README.md)：Phase 2（插件化）的交付说明：扩展点、两种装配、依赖规则与依赖图、ADR、过程记录、一致性自查与验收证据。
- [doc/phase1-architecture.md](doc/phase1-architecture.md)：Phase 1 的架构方案（模块划分、设计模式、约定补充、过程记录）。
- [vscode-svg/README.md](vscode-svg/README.md)：第一部分 VSCode 扩展（SVG 文件标记与大纲）的用法与交付总览。
