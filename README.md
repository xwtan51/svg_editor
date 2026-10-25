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

`npm ci` 按 `package-lock.json` 安装依赖；`npm run cli` 启动编辑器（输入 `help` 查看全部命令，Ctrl-D 退出）；`npm test` 运行全部测试。另有 `npm run typecheck` 做类型检查。

## 文档

设计文档（架构方案、过程记录、一致性自查、质量保证手段）见 [doc/README.md](doc/README.md)。
