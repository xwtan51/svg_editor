# vscode-svg · SVG 文件标记（规格 A.1）

一个 VSCode 扩展：Explorer 中的 `.svg` **文件**旁显示 `[]` 标记。非 SVG 文件和目录不加标记，文件名和内容都不修改。

这是一个独立工程，有自己的 `package.json`、`package-lock.json` 和 `tsconfig.json`，与根目录的 CLI 不共用依赖和构建配置。

- 根目录的 `tsconfig.json` 只包含 `src`、`tests`，根目录的 vitest 只扫描 `tests/`，所以根目录的 `npm run typecheck` 和 `npm test` 都不会涉及本目录。
- ⚠️ **S5 以后如果根目录改用 npm workspaces，`vscode-svg/` 不能被纳入 workspace**。原因有三：它的依赖版本（`@types/vscode`、esbuild）要跟着本机 VSCode 走；它打成 CJS，而 CLI 是 ESM；它的指标要单独统计。根目录的 `workspaces` 字段请只列 CLI 的包（例如 `packages/*`、`plugins/*`），不要写 `*` 或 `.`。

## 命令

需要 Node.js 22 或更高版本，以及 VSCode 1.146.0 或更高版本（见 VA10）。以下命令都在 `vscode-svg/` 下执行。

```bash
npm ci
```

```bash
npm run build
```

```bash
npm test
```

```bash
npm run typecheck
```

- `npm run build`：esbuild 把 `src/extension.ts` 打包成 CJS 的 `dist/extension.js`，`vscode` 是 external。
- `npm run watch`：监听源码，修改后自动重新构建。
- `npm ci` 时 npm 可能提示 esbuild 和 fsevents 的安装脚本被拦截。这不影响使用：esbuild 的二进制由可选依赖 `@esbuild/darwin-arm64` 提供，fsevents 只是 vitest 监听模式的可选依赖。

## F5 运行

1. 先执行一次 `npm ci`。
2. 在 VSCode 中打开 **`vscode-svg/` 文件夹**本身（不是仓库根目录），例如在终端运行 `code vscode-svg`。
3. 按 F5，或在“运行和调试”里选 **Run SVG Badge on samples/**。VSCode 会先执行 `npm: build` 任务，再启动 Extension Development Host（标题栏带“[扩展开发宿主]”），并直接打开 `samples/`。
   - 这个配置带 `--disable-extensions`，只加载本扩展，以免其他扩展的标记或图标干扰判断。如果想连同自己安装的扩展一起看，选第二个配置 **(keep my other extensions)**。
4. 在新窗口的 Explorer 中按下面的清单逐项确认。

### 符号链接（手动创建，不入库）

符号链接不提交进 git（`vscode-svg/.gitignore` 已忽略下面三个名字）。需要验证 VA5 时，在启动 F5 **之前**或之后，在仓库根目录执行：

```bash
cd vscode-svg/samples && ln -s example.svg link-to-file.svg && ln -s icons.svg link-to-dir.svg && ln -s does-not-exist.svg dangling.svg
```

验证完以后删除：

```bash
cd vscode-svg/samples && rm link-to-file.svg link-to-dir.svg dangling.svg
```

### 手动确认清单

**应该有 `[]`**

| 资源 | 说明 |
|---|---|
| `example.svg` | 普通 SVG 文件（对应规格图 A.1） |
| `LOGO.SVG` | 扩展名全大写（VA3） |
| `Mixed.Svg` | 扩展名大小写混合（VA3） |
| `link-to-file.svg`（手动创建） | 指向文件的符号链接（VA5） |
| 打开 `example.svg` 后的编辑器标签页 | VSCode 默认也会在标签页上显示装饰（设置项 `workbench.editor.decorations.badges`），这不是本扩展另外做的 |

**不应该有 `[]`**

| 资源 | 说明 |
|---|---|
| `plain.txt` | 普通文本文件 |
| `icons.svg/` | 名字以 `.svg` 结尾的**目录** |
| `icons.svg/README.md` | 目录里的普通文件 |
| `diagram.svg.txt` | 名字里有 `.svg`，扩展名却是 `.txt` |
| `svg` | 没有扩展名的文件 |
| `.svg` | 只有扩展名的隐藏文件（VA4） |
| `.vscode/`、`.vscode/settings.json` | 目录和 JSON 文件 |
| `link-to-dir.svg`（手动创建） | 指向目录的符号链接（VA5） |
| `dangling.svg`（手动创建） | 断开的符号链接（VA5） |

鼠标悬停在 `[]` 上时，提示文字应包含 `SVG file`。所有文件名都与磁盘上一致，标记只是附加显示。

**刷新（VA7）**：在 Extension Development Host 里操作。终端可用菜单“终端 → 新建终端”打开，工作目录就是 `samples/`。

| 步骤 | 期望 |
|---|---|
| R1 在 Explorer 中把 `plain.txt` 重命名为 `plain.svg` | 立即出现 `[]`；改回 `plain.txt` 后消失 |
| R2 在 Explorer 中新建文件夹 `x.svg` | 没有 `[]`（做完后删除） |
| R3 终端执行 `printf '<svg/>' > flip.svg` | `flip.svg` 出现 `[]` |
| R4 终端执行 `rm flip.svg && mkdir flip.svg` | 同名的 `flip.svg` 变成目录，`[]` 在一两秒内**消失** |
| R5 终端执行 `rmdir flip.svg && printf '<svg/>' > flip.svg` | `[]` 重新出现；最后执行 `rm flip.svg` 清理 |

R4、R5 正是需要刷新事件的情况：URI 不变，资源类型变了。没有 VA7 的 watcher 时，VSCode 会一直沿用缓存的旧结果。

## 打包 `.vsix`（可选）

```bash
npx @vscode/vsce@4.1.1 package
```

```bash
code --install-extension svg-badge-0.1.0.vsix
```

- 打包前会自动执行 `vscode:prepublish`（类型检查、单元测试、构建）。
- 产物 `svg-badge-0.1.0.vsix` 只包含 `package.json`、`README.md` 和 `dist/extension.js`（见 `.vscodeignore`）；根目录 `.gitignore` 已忽略 `*.vsix`。
- 打包时会出现 `WARNING LICENSE, LICENSE.md, or LICENSE.txt not found`，但只是警告，不影响打包（VA11）。
- 卸载：`code --uninstall-extension xwtan51.svg-badge`。
- 不想安装到自己的 VSCode 里，可以加 `--extensions-dir /tmp/vsce-ext`，装进临时目录试一试。

## 结构

| 类 | 职责 | 依赖 `vscode` |
|---|---|---|
| `core/Badge` | 值对象：badge 文本和 tooltip；构造时检查 1–2 个字符，提供常量 `Badge.SVG` = `[]` | 否 |
| `core/ResourceKind` | 值对象：资源本身或链接目标是文件、目录还是未知，以及是否经由符号链接 | 否 |
| `core/ResourcePath` | 值对象：URI 路径的基名和扩展名（`.svg` 隐藏文件规则、大小写无关比较） | 否 |
| `core/FileTypeMask` | 把 `vscode.FileType` 位掩码按位解码成 `ResourceKind`；常量与 `@types/vscode` 由测试对齐 | 否 |
| `core/SvgBadgeRule` | 纯规则：给定 `ResourcePath` 和 `ResourceKind`，返回 `Badge.SVG` 或不返回；附带名字预检和 watcher 用的 glob | 否 |
| `core/SchemeFilter` | 哪些 URI scheme 才会被装饰（`file`、`vscode-remote`） | 否 |
| `host/VscodeResourceKindReader` | 适配：`workspace.fs.stat(uri).type` 转成 `ResourceKind`；失败时返回 `undefined`，从不 reject | 仅类型导入（运行时不加载） |
| `host/SvgFileDecorationProvider` | 实现 `FileDecorationProvider`，依次做 scheme 过滤、名字预检、查类型、套规则，最后生成 `new FileDecoration` | 是 |
| `host/SvgResourceWatcher` | 把 `*.svg` 的文件系统事件转成 `onDidChangeFileDecorations` | 是 |
| `extension.ts` | 入口：`activate` 组装对象并注册，Disposable 放进 `context.subscriptions`；`deactivate` 为空 | 是 |

`tests/unit/architecture.test.ts` 检查四条约束：一类一文件、文件名 = 类名、不用 default export、`core/` 不导入 `vscode`。单元测试中，`vscode` 由 `vitest.config.mts` 的 alias 指向 `tests/stubs/vscode.ts`，这只是最小的替身。真实宿主里的行为（badge 校验、装饰缓存、文件监听）靠上面的 F5 清单确认；S2 起再加集成测试。

## 决定（VA 编号，供 S3 引用）

| 编号 | 决定 | 依据 |
|---|---|---|
| VA1 | 激活事件只写 `onStartupFinished` | 文件装饰没有 contribution point，VSCode 不会因为它自动激活扩展，所以必须显式写激活事件。`*` 会拖慢启动；`onStartupFinished` 在启动完成后才激活，不阻塞窗口。`workspaceContains:**/*.svg` 要在启动时扫描整个工作区，而且工作区里原本没有 SVG、后来才新建时，扩展不会激活。晚一点注册也不会漏标记：`DecorationsService.registerDecorationsProvider` 注册时会发出“所有资源都可能变化”的事件，Explorer 会对已显示的行重新询问（VSCode 1.146.0 源码 `src/vs/workbench/services/decorations/browser/decorationsService.ts`） |
| VA2 | badge 固定为 `[]`，tooltip 为 `SVG file`；`Badge` 构造时要求 1–2 个字符（按码点计） | `FileDecoration.validate`（`src/vs/workbench/api/common/extHostTypes.ts`）遇到超过 2 个字符的 badge 会抛错。扩展宿主（`extHostDecorations.ts`）会捕获这个错误，写一条 `INVALID decoration` 警告并丢弃该装饰，结果就是所有标记悄无声息地消失。所以必须在构造 `Badge` 时就把关。按码点计数不会比 VSCode 的计数宽松。`Badge.test.ts` 检查长度，防止以后改成 `[svg]` |
| VA3 | 扩展名**不区分大小写**：`.SVG`、`.Svg` 都算 SVG | macOS 和 Windows 的默认文件系统不区分大小写，浏览器和多数工具也认 `.SVG`。VSCode 的装饰缓存本身按“忽略路径大小写”作键（同一文件中 `TernarySearchTree.forUris(… ignorePathCasing …)`），大小写无关的规则正好与之一致。watcher 的 glob 相应写成 `**/*.[sS][vV][gG]`。⚠️ S2 的大纲选择器要与此一致（见 `doc/observations.md` 第 3 项） |
| VA4 | 名为 `.svg` 的隐藏文件**不算** SVG；`.foo.svg`、`..svg` 算 | 与 Node `path.posix.extname` 和 VSCode `resources.extname` 一致：`.svg` 是“没有扩展名的点文件”，就像 `.gitignore` 不是“扩展名为 gitignore 的文件”。`ResourcePath.test.ts` 用 12 个易误判的名字与 `path.posix.extname` 逐个对照 |
| VA5 | 符号链接看**目标**：指向文件的加标记，指向目录的不加，断开的不加；既不是文件也不是目录（socket、FIFO、设备）的不加 | `workspace.fs.stat` 跟随链接：链接到文件时是 `SymbolicLink｜File`（65），到目录时是 66，断链时是 `SymbolicLink｜Unknown`（64）（`src/vs/platform/files/node/diskFileSystemProvider.ts` 的 `toType()`）。规格说“目录不加标记”，Explorer 也把指向目录的链接显示为可展开的文件夹，所以不加。断链无法确认是不是文件，按“只标记确认的文件”处理。判断全部用 `&`（`FileTypeMask`），不用 `===` |
| VA6 | 只装饰 `file` 和 `vscode-remote` 两种 scheme；其他 scheme（`untitled`、`git`、`gitlens`、`vscode-userdata`、`output`……）在调用 `stat` **之前**就直接返回 `undefined` | 规格要的是“Explorer 中的文件”：本地工作区是 `file`，Remote-SSH / WSL / 容器窗口里的工作区是 `vscode-remote`。`untitled` 没有磁盘文件，也不在 Explorer 中；`git` 等是历史版本或其他数据的视图，标 `[]` 并不表示“工作区里有一个 SVG 文件”，而且这类文件系统的 `stat` 可能很慢（`git` 每次都要起 git 进程）。注：`vscode-remote` 是按 VSCode 的远程 URI 约定加入的，本机没有远程环境，未实测 |
| VA7 | **实现** `onDidChangeFileDecorations`：`SvgResourceWatcher` 监听 `**/*.[sS][vV][gG]` 的创建、修改、删除，并把相应的 URI 重新广播出去 | 见下文“刷新” |
| VA8 | `stat` 失败（文件刚被删除、没有权限、该 scheme 没有文件系统提供者）时返回 `undefined`，同步抛出的异常也一样；请求已被取消时返回 `undefined`；名字不符合的资源不调用 `stat` | 不让异常或未处理的 Promise 拒绝进入扩展宿主。provider 一旦 reject，扩展宿主会把错误写进日志（`extHostDecorations.ts` 中的 `this._logService.error(err)`），主线程则丢弃该条缓存，下次渲染时重新询问（`_fetchData` 的 catch）。刚删除的文件每次都这样，就会反复报错。Explorer 每显示一行都会询问一次，名字预检可以让绝大多数资源连一次 I/O 都不做 |
| VA9 | `extension.ts` 不遵守一类一文件，导出两个函数 `activate` / `deactivate` | VSCode 的扩展约定要求入口模块导出这两个函数，与 Phase 1 的 `cli/main.ts` 是同一类例外。它只组装和注册，不含逻辑；architecture test 限制它只能导出这两个名字 |
| VA10 | TypeScript 7.0.2，只用于类型检查（`tsc --noEmit`）；esbuild 0.28.2 负责打包成 CJS；`engines.vscode` 为 `^1.146.0`，`@types/vscode` 为 `1.146.0` | TS 版本与根目录 CLI 相同，两边的类型检查行为一致。本工程不调用 TS Compiler API，不受 TS 7 只有 `unstable/*` 接口的影响；编译由 esbuild 完成，所以采用 `module: preserve` 加 `moduleResolution: bundler`，并开启 `verbatimModuleSyntax`，保证 `import type` 在打包时被擦除（`VscodeResourceKindReader` 运行时不加载 `vscode`）。VSCode 1.146.0 来自本机 `code --version`；`manifest.test.ts` 检查两个版本一致且不高于 1.146 |
| VA11 | 不加 LICENSE 文件，`package.json` 不写 `license` 字段；vsce 打包时只给警告 | 用什么许可证是作者的决定，仓库根目录也没有 LICENSE。vsce 4.1.1 实测：缺 LICENSE 只报 WARNING，照常生成 `.vsix`；`repository` 字段已补上 |

### 刷新（VA7）的依据

- VSCode 的 `DecorationsService` 按 URI 缓存每个 provider 的结果，**“没有标记”也会被缓存**（`_keepItem` 把 `undefined` 存成 `null`）。缓存只在 provider 触发 `onDidChange` 时才丢弃并重新询问。源码见 VSCode 1.146.0 的 `src/vs/workbench/services/decorations/browser/decorationsService.ts`，具体是 `registerDecorationsProvider`、`getDecoration`、`_fetchData`、`_keepItem` 四处。
- 因此：
  - **`a.txt` 重命名为 `a.svg`**：`a.svg` 是一个新 URI，缓存中没有它的结果，VSCode 会询问 provider，标记会正确出现，**不需要**刷新事件。新建 `x.svg` 目录同理，询问时 `stat` 得到目录，不会加标记。
  - 但**同一个 URI 换了类型**时（删掉文件 `x.svg` 再 `mkdir x.svg`，或者反过来），缓存中的旧结果会一直留着，**需要**刷新事件。同样的情况还有：某次询问恰好赶上文件正在创建，`stat` 失败，“无标记”也被缓存下来。
- 只监听创建和删除还不够：VSCode 的文件监听会把**同一路径的“删除后紧跟创建”合并成一次“修改”**（`src/vs/platform/files/common/watcher.ts` 的 `EventCoalescer`：“Flatten DELETE followed by CREATE into CHANGE”）。所以修改事件也要转发，代价是每次保存 SVG 文件时多一次 `stat`。
- 仍然覆盖不到的情况（已知限制）：符号链接的**目标**变了而链接本身没变（例如 `link.svg` 指向的文件被删除），事件只会落在目标路径上，链接的标记不会更新，要等重新加载窗口。
- 实测：F5 清单中的 R1–R5。
