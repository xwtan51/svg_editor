# vscode-svg · SVG 文件标记（规格 A.1）与 SVG 大纲（规格 A.2）

一个 VSCode 扩展，做两件事：

- **文件标记（A.1）**：Explorer 中的 `.svg` **文件**旁显示 `[]` 标记。非 SVG 文件和目录不加标记，文件名和内容都不修改。
- **大纲（A.2）**：用文本编辑器打开 SVG 文件后，VSCode 原生的大纲（Outline）视图显示元素的嵌套层级，节点名为 `标签名#id` 或 `标签名`。点击节点会跳到源码；编辑后大纲随之更新；XML 不完整时，显示出错位置之前的部分，扩展不会出错。

这是一个独立工程，有自己的 `package.json`、`package-lock.json` 和 `tsconfig.json`，与根目录的 CLI 不共用依赖和构建配置。

- 根目录的 `tsconfig.json` 只包含 `src`、`tests`，根目录的 vitest 只扫描 `tests/`，所以根目录的 `npm run typecheck` 和 `npm test` 都不会涉及本目录。
- ⚠️ **S5 以后如果根目录改用 npm workspaces，`vscode-svg/` 不能被纳入 workspace**。原因有三：它的依赖版本（`@types/vscode`、esbuild 的目标）要跟着所支持的最低 VSCode 版本走（VA10）；它打成 CJS，而 CLI 是 ESM；它的指标要单独统计。根目录的 `workspaces` 字段请只列 CLI 的包（例如 `packages/*`、`plugins/*`），不要写 `*` 或 `.`。

## 命令

扩展本身支持 **VSCode 1.85.0 及以上**（见 VA10）。开发工具链（vitest、esbuild、类型检查）需要 Node.js 22 或更高版本；这只是开发机的要求，与扩展运行时用的 Node 无关，后者由 VSCode 自带。以下命令都在 `vscode-svg/` 下执行。

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
- `npm test` 只跑单元测试（`tests/unit/`）。集成测试另有命令 `npm run test:integration`、`npm run test:restricted`，见“集成测试”。
- `npm run watch`：监听源码，修改后自动重新构建。
- `npm ci` 时 npm 可能提示 esbuild 和 fsevents 的安装脚本被拦截。这不影响使用：esbuild 的二进制由可选依赖 `@esbuild/darwin-arm64` 提供，fsevents 只是 vitest 监听模式的可选依赖。

## F5 运行

1. 先执行一次 `npm ci`。
2. 在 VSCode 中打开 **`vscode-svg/` 文件夹**本身（不是仓库根目录），例如在终端运行 `code vscode-svg`。
3. 按 F5，或在“运行和调试”里选 **Run SVG Badge on samples/**。VSCode 会先执行 `npm: build` 任务，再启动 Extension Development Host（标题栏带“[扩展开发宿主]”），并直接打开 `samples/`。
   - 这个配置带 `--disable-extensions`，只加载本扩展，以免其他扩展的标记或图标干扰判断。如果想连同自己安装的扩展一起看，选第二个配置 **(keep my other extensions)**。
4. 在新窗口中按下面两份清单逐项确认：文件标记（A.1）和大纲（A.2）。

### 用文本编辑器打开 SVG

VSCode 1.146.0 默认用内置的**图片预览**（Image Preview）打开 `.svg`。图片预览不是文本编辑器，所以大纲视图只会显示 `The active editor cannot provide outline information.`（观察表第 4 项）。较老的版本不一定这样：1.85.0 内置图片预览的文件模式是 `*.{jpg,jpe,jpeg,png,bmp,gif,ico,webp,avif}`，不含 `svg`，默认就用文本编辑器打开；1.146.0 的模式末尾多了 `svg`（集成测试的对照用例在两个版本上分别确认）。

- **F5 窗口**：`samples/.vscode/settings.json` 已设置 `"workbench.editorAssociations": { "*.svg": "default" }`，`.svg` 直接用文本编辑器打开。这个模式不区分大小写（1.85.0 把模式和文件名都转成小写再比较，1.146.0 用 `ignoreCase: true`），`LOGO.SVG`、`Mixed.Svg` 同样适用。集成测试检查：有这条设置时三个文件都用文本编辑器打开；临时去掉它，1.146.0 中三个文件都进入 `imagePreview.previewEditor`。
- **普通窗口**（例如装了 `.vsix` 以后）：在已打开的预览上执行命令面板中的 **Reopen Editor With…**（中文界面为“重新打开编辑器的方式…”），选 **Text Editor**（“文本编辑器”）；也可以在 Explorer 中右键文件，选 **Open With…** → **Text Editor**。这样才能看到大纲。想一直这样打开，可以在自己的设置里加上同样的 `workbench.editorAssociations`。

### 符号链接（手动创建，不入库）

符号链接不提交进 git（`vscode-svg/.gitignore` 已忽略下面三个名字）。需要验证 VA5 时，在启动 F5 **之前**或之后，在仓库根目录执行：

```bash
cd vscode-svg/samples && ln -s example.svg link-to-file.svg && ln -s icons.svg link-to-dir.svg && ln -s does-not-exist.svg dangling.svg
```

验证完以后删除：

```bash
cd vscode-svg/samples && rm link-to-file.svg link-to-dir.svg dangling.svg
```

### 手动确认清单：文件标记（A.1）

**应该有 `[]`**

| 资源 | 说明 |
|---|---|
| `example.svg` | 普通 SVG 文件（对应规格图 A.1） |
| `broken.svg` | 故意写坏的 SVG：标记只看名字和类型，不看内容 |
| `LOGO.SVG` | 扩展名全大写（VA3） |
| `Mixed.Svg` | 扩展名大小写混合（VA3） |
| `link-to-file.svg`（手动创建） | 指向文件的符号链接（VA5） |
| 打开 `example.svg` 后的编辑器标签页 | VSCode 默认也会在标签页上显示装饰（设置项 `workbench.editor.decorations.badges`），这不是本扩展另外做的 |

**不应该有 `[]`**

| 资源 | 说明 |
|---|---|
| `plain.txt` | 普通文本文件 |
| `plain.xml` | 普通 XML 文件（语言 ID 与 `.svg` 同为 `xml`） |
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

### 手动确认清单：大纲（A.2）

在 F5 窗口中操作（`.svg` 已用文本编辑器打开，见上文）。大纲在 Explorer 底部的 **OUTLINE**（“大纲”）区域，可能需要先展开。集成测试已证明 provider 每次查询都用最新文本；下面的 O3、O4 确认的是 VSCode 何时重新查询、界面如何呈现，这是集成测试证明不了的，要在界面上看。对照的是观察表第 6–8 项（原生大纲的行为）和图 A.2。

| 步骤 | 期望 |
|---|---|
| O1 打开 `example.svg`，展开大纲 | 与图 A.2 一致：`svg` › `g#flow` › `rect#start`，`g#flow` › `g#nested` › `text`；`text` 没有 id，只显示标签名。`svg`、`g#flow`、`g#nested` 是同一个花括号图标（`Module`、`Namespace` 在 codicon 中共用 `0xea8b`），`rect#start`、`text` 是字段图标（VA18）；节点名后面没有灰色附加文字（VA20） |
| O2 点击 `rect#start` | 编辑器定位到**第 3 行**，光标在 `<rect` 的 `r` 之前（第 3 行第 6 列），不选中文字，焦点留在大纲；与观察表第 6 项 Markdown、JSON 的行为相同（VA19） |
| O3 在大纲的 `…` 菜单中打开 **Follow Cursor**（“跟随光标”），把光标依次移到第 5 行的 `hello`、第 6 行的 `</g>`、第 3 行 | 高亮依次为 `text`、`g#nested`（结束标签也属于该元素，VA19）、`rect#start`；与观察表第 7 项相同。做完关掉 Follow Cursor |
| O4 在第 5 行行尾回车，逐字输入 `<circle id="c" r="3"/>` | 输入到一半时（例如 `<circle id="c`），原有节点保持不变，不闪烁、不清空；输入完 `/>` 后，`g#nested` 下出现 `circle#c`（VA16）。对照观察表第 8 项：Markdown 逐字更新，未见整树清空。然后撤销 |
| O5 把第 4 行的 `<g id="nested">` 改成 `<g id="nested>`（删去一个引号） | `g#nested` 及其子节点暂时消失，剩 `svg` › `g#flow` › `rect#start`（VA16）；没有错误提示，扩展也没有停止工作：启动 F5 的那个原窗口的**调试控制台**（Debug Console）中没有以 `[svg-badge]` 开头的行。把引号补回，完整的树恢复 |
| O6 打开 `broken.svg` | 大纲为 `svg` › `g#ok` › `rect#first`；出错的 `circle` 及其后的 `text#after` 不显示 |
| O7 打开 `LOGO.SVG`、`Mixed.Svg` | 分别为 `svg` › `circle#dot`、`svg` › `rect`（VA3、VA14） |
| O8 打开 `plain.xml` 和隐藏文件 `.svg` | 都没有本扩展提供的节点，大纲与观察表第 4 项不装扩展时的文本编辑器相同（VA14、VA4） |
| O9 按 Cmd+Shift+O（转到编辑器中的符号），输入 `:` | 符号按种类分组：1 个模块（`svg`）、2 个命名空间、2 个字段（VA18） |

## 打包 `.vsix`（可选）

```bash
npx @vscode/vsce@4.1.1 package
```

```bash
code --install-extension svg-badge-0.1.0.vsix
```

- 打包前会自动执行 `vscode:prepublish`（类型检查、单元测试、构建）。
- 在普通窗口中，`.svg` 要用 **Reopen Editor With… → Text Editor** 打开才有大纲（见“用文本编辑器打开 SVG”）。
- 打开还没信任的文件夹（受限模式）时，扩展照常工作（VA12）；`npm run test:restricted` 会自动验证这一点。
- 产物 `svg-badge-0.1.0.vsix` 只包含 `package.json`、`README.md` 和 `dist/extension.js`（见 `.vscodeignore`，`dist-test/`、`.vscode-test/` 也排除在外）；根目录 `.gitignore` 已忽略 `*.vsix`。
- 打包时会出现 `WARNING LICENSE, LICENSE.md, or LICENSE.txt not found`，但只是警告，不影响打包（VA11）。
- 卸载：`code --uninstall-extension xwtan51.svg-badge`。
- 不想安装到自己的 VSCode 里，可以加 `--extensions-dir /tmp/vsce-ext`，装进临时目录试一试。

## 集成测试

```bash
npm run test:integration
```

```bash
VSCODE_TEST_VERSION=1.85.0 npm run test:integration
```

```bash
npm run test:restricted
```

- 默认使用 VSCode **1.146.0**（作者本机的版本）；环境变量 `VSCODE_TEST_VERSION` 可以切换到任何版本，最低支持的版本是 **1.85.0**（VA10）。第一次运行会把该版本下载到 `vscode-svg/.vscode-test/`（约 120 MB），以后复用。
- 命令先构建扩展和测试代码（`dist-test/`，CJS，目标 `node18`，在扩展宿主里运行），再启动下载的 VSCode，运行结束后以 VSCode 的退出码退出，0 表示全部通过。`.vscode-test/` 和 `dist-test/` 都不入库，也不进 `.vsix`。
- 在 Linux 上没有图形界面时，要加 `xvfb-run -a`，例如 `xvfb-run -a npm run test:integration`。
- CI（根目录 `.github/workflows/test.yml` 的 `vscode-svg` job）依次执行 `npm ci`、`npm run typecheck`、`npm test`、`npm run build`，再用 `xvfb-run -a` 在 1.146.0 上跑集成测试，下载目录 `.vscode-test/` 有缓存。1.85.0 和受限模式检查只在本机运行（后者需要联网打包）。

**隔离**：启动器 `tests/integration/IntegrationLauncher.ts` 用 `@vscode/test-electron` 下载 VSCode，命令行则由它自己拼装：`runTests` 会无条件加上 `--disable-workspace-trust`，那样受限模式检查就没有意义了。每次启动都满足：

- 使用下载的 VSCode，而不是本机安装的那一个；
- 带 `--disable-extensions`（只有本扩展以开发模式加载；受限模式检查除外，见下文）；
- `--user-data-dir`、`--extensions-dir`、`--shared-data-dir` 各指向一个新建的临时目录。1.85.0 不认识 `--shared-data-dir`，只打印 `Warning: 'shared-data-dir' is not in the list of known options, but still passed to Electron/Chromium.`，不影响运行（`--no-cached-data` 也一样）；
- `HOME` 也指向一个临时目录：VSCode 把 `~/.vscode/argv.json` 放在所有 `--*-dir` 之外，还会改写其中的 `enable-crash-reporter`。S2 开发时第一次运行就改写过作者本机的这个文件，所以加了这一条；
- 工作区是 `samples/` 的临时副本，测试中的编辑和设置改动不会碰到仓库；
- 不继承 `VSCODE_*`、`ELECTRON_RUN_AS_NODE` 等环境变量（在 VSCode 的终端里运行时会有这些变量）；
- 结束后删除所有临时目录。

**大纲用例**（`tests/integration/suite/outline.ts`，在扩展宿主中运行，用的是一个约 40 行的小 runner，没有引入 mocha）：

| 用例 | 内容 |
|---|---|
| 版本 | 打印并核对 VSCode 版本、扩展宿主的 Node 和 Electron 版本（1.85.0：Node 18.15.0 / Electron 25.9.7；1.146.0：Node 24.22.1 / Electron 43.8.6） |
| 激活 | 打开 `example.svg` 前扩展未激活；打开后激活，语言 ID 为 `xml` |
| 图 A.2 | `vscode.executeDocumentSymbolProvider` 的结果为 `svg[g#flow[rect#start, g#nested[text]]]`，`rect#start` 的 `range` 和 `selectionRange` 都在第 3 行，`selectionRange` 正好是 `rect` 四个字符；`SymbolKind` 和 `detail` |
| 大小写 | `LOGO.SVG`、`Mixed.Svg` 有大纲 |
| 不提供大纲 | `plain.xml`（语言 ID 也是 `xml`）和隐藏文件 `.svg` 没有本扩展的大纲 |
| 编辑后更新 | 用 `WorkspaceEdit` 插入 `<circle id="added"/>`，紧接着再查一次，新节点出现在第 6 行 |
| 不完整的 XML | 改成不完整的 XML 后查询不出错，结果是出错位置之前的部分；修好后大纲恢复；`broken.svg` 同理 |
| 空文档、只有注释、二进制垃圾 | 查询不出错，大纲为空（VSCode 把空结果报告为 `undefined`） |
| untitled | 带 `.svg` 名的新文件有大纲，`Untitled-1` 没有（VA15） |
| 大文件 | 5 万个元素、约 260 万字符，一次查询约 0.2 s |
| 深嵌套 | 2000 层嵌套返回 256 层，而不是在 VSCode 内部栈溢出后变空（VA22） |
| 编辑器关联 | 见“用文本编辑器打开 SVG” |
| 日志 | 扩展宿主不允许在测试中替换 `console.error`（它被重新定义成 setter 为空的访问器），所以由启动器检查 VSCode 的输出：出现 `[svg-badge] SVG outline failed` 就判失败；第一个用例写一行自检标记，启动器看不到它也判失败，免得检查本身失效而不自知 |

集成测试只能证明 provider 每次查询都用的是最新文本。大纲视图在编辑时**多久**重新查询一次，是 VSCode 的事，由上面的 O3、O4 在界面上确认。

**受限模式检查**（`npm run test:restricted`，VA12）：用 `vsce package` 打出真正的 `.vsix`，用 `code --install-extension` 装进临时的 `--extensions-dir`，在全新的 `--user-data-dir`（启动时不弹信任对话框）下打开 `samples/` 的临时副本，**不**加 `--disable-workspace-trust` 和 `--disable-extensions`。测试代码挂在一个临时的空白开发扩展里运行（开发扩展不受信任规则约束，被测的扩展受约束）。先用真实的包检查：工作区未受信任，扩展从安装目录加载、激活并提供大纲；再用一个去掉 `capabilities` 的对照包检查：扩展不出现在 `extensions.all` 中，大纲为空。对照组证明窗口确实处在受限模式，也证明这项声明正是差别所在。打包要联网下载 `@vscode/vsce@4.1.1`。

## API 清单（VA10 的依据）

本扩展在运行时用到的全部 VSCode 接口和清单字段如下。`vscode.d.ts` 中的接口由“`@types/vscode` 1.85.0 下类型检查通过”证明存在；清单字段、设置和激活事件不在类型里，由 1.85.0 上的集成测试证明有效。

| 接口 / 字段 | 用在哪里 |
|---|---|
| `window.registerFileDecorationProvider`、`FileDecorationProvider`、`FileDecoration` | 文件标记（A.1） |
| `workspace.fs.stat`、`FileType`（位掩码） | 判断资源类型（VA5） |
| `workspace.createFileSystemWatcher`（字符串 glob）、`FileSystemWatcher.onDidCreate/onDidChange/onDidDelete` | 刷新（VA7） |
| `EventEmitter`、`Event`、`Disposable`、`Uri`、`CancellationToken`、`ExtensionContext.subscriptions` | 通用 |
| `activationEvents: onStartupFinished` | 激活（VA1） |
| `capabilities.untrustedWorkspaces` | 受限模式（VA12） |
| `languages.registerDocumentSymbolProvider`（第三个参数 `DocumentSymbolProviderMetadata.label`）、`DocumentSymbolProvider` | 大纲（A.2） |
| `DocumentSymbol`、`SymbolKind`、`Range`、`Position`、`TextDocument.getText`、`TextDocument.positionAt` | 大纲节点 |
| `DocumentFilter` 的 `language` 和 `pattern`（字符串 glob，含 `?` 和 `[…]`） | 大纲选择器（VA14） |
| `activationEvents: onLanguage:xml` | 激活（VA1） |
| `workbench.editorAssociations`（对象形式，只用于 `samples/`） | 用文本编辑器打开 SVG |

集成测试另外用到 `commands.executeCommand("vscode.executeDocumentSymbolProvider")`、`workspace.openTextDocument`（含 untitled）、`window.showTextDocument`、`WorkspaceEdit` 和 `workspace.applyEdit`、`window.tabGroups` 和 `TabInputText`、`TabInputCustom`、`workspace.getConfiguration().inspect/update`、`extensions.getExtension`、`workspace.isTrusted`。它们同样在 `@types/vscode` 1.85.0 下类型检查通过，并在 1.85.0 上实际运行。

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
| `core/SourceSpan` | 值对象：半开区间 `[start, end)`，UTF-16 偏移量；`contains` | 否 |
| `core/XmlSyntaxError` | 异常：文本在某个偏移量处不完整或不合法；只在 core 内部抛出和捕获 | 否 |
| `core/XmlAttributeDecoder` | 属性值规范化，展开预定义实体和字符引用（VA17） | 否 |
| `core/XmlStartTag`、`core/XmlEndTag` | 词法单元：起始标签（名字、名字区间、整个标签的区间、属性、是否自闭合）和结束标签；`applyTo(builder)` 双重分派，不用 `instanceof` | 否 |
| `core/XmlTokenizer` | 分词器：只产出起始标签和结束标签，跳过文本、注释、CDATA、处理指令和 DOCTYPE；结构有问题时在出问题的地方抛 `XmlSyntaxError`（VA13、VA16、VA21） | 否 |
| `core/OutlineRole` | 根、容器、叶子三种角色，按深度和子元素个数决定（VA18） | 否 |
| `core/OutlineNode` | 大纲节点：显示名、`detail`、角色、`range`、`selection`、子节点；构造时检查名字非空、`selection ⊆ range`（VA17、VA19、VA20） | 否 |
| `core/OpenElement` | 已读到起始标签、还没读到结束标签的元素：收集子节点，关闭时生成 `OutlineNode` | 否 |
| `core/OutlineTreeBuilder` | 用显式栈搭树；结束标签必须与最内层元素匹配；出错时关闭所有未闭合元素；深度上限 256（VA16、VA22） | 否 |
| `core/SvgOutline` | 一次解析的结果：顶层节点，以及（不完整时的）第一个语法错误 | 否 |
| `core/SvgOutlineParser` | 纯逻辑入口：文本 → `SvgOutline`；语法错误不外抛 | 否 |
| `core/SvgOutlineScope` | 大纲选择器的内容：语言 `xml` 和文件名模式 `**/?*.[sS][vV][gG]`，作为普通数据（VA14、VA15） | 否 |
| `host/OutlineSymbolAdapter` | 适配：`OutlineNode` 树 → `DocumentSymbol` 树，偏移量经 `document.positionAt` 变成 `Position`；角色 → `SymbolKind`；显式栈 | 是 |
| `host/SvgDocumentSymbolProvider` | 实现 `DocumentSymbolProvider`：当前文本 → 解析 → 适配；同步、永不抛错、尊重取消（VA22） | 仅类型导入（运行时不加载） |
| `extension.ts` | 入口：`activate` 组装对象，注册文件装饰和大纲两个 provider，Disposable 放进 `context.subscriptions`；`deactivate` 为空 | 是 |

`tests/unit/architecture.test.ts` 检查：一类一文件、文件名 = 类名、不用 default export、`core/` 不导入 `vscode`、入口只导出 `activate` 和 `deactivate`、两个 host 类只做类型导入、`src/` 不导入 Node 内置模块（VA10），并写死 `core/`、`host/` 的文件清单，新增文件必须同步登记。单元测试中，`vscode` 由 `vitest.config.mts` 的 alias 指向 `tests/stubs/vscode.ts`，这只是最小的替身，只有 `DocumentSymbol` 照搬了 VSCode 构造函数中的两项检查（名字非空、`selectionRange` 在 `range` 内；1.85.0 和 1.146.0 的 `extHostTypes` 中完全相同），这样单元测试会在真实宿主抛错的同一个地方失败。`tests/stubs/FakeTextDocument.ts` 按 VSCode 的规则实现 `positionAt`。真实宿主中的行为由集成测试和上面两份手动清单确认。

## 决定（VA 编号，供 S3 引用）

| 编号 | 决定 | 依据 |
|---|---|---|
| VA1 | 激活事件为 `onStartupFinished` 和 `onLanguage:xml`，两者各管一件事 | 文件装饰和大纲 provider 都没有 contribution point，只能在代码里注册，VSCode 不会因为它们自动激活扩展，所以必须显式写激活事件。**`onLanguage:xml`（大纲）**：观察表第 1–3 项实测 `.svg`、`.SVG`、`.Svg` 的语言 ID 都是 `xml`。VSCode 启动时如果恢复了一个已打开的 SVG 编辑器，或者在启动完成前就打开了 SVG，这个事件会让扩展立即激活，大纲马上可用，不必等启动完成。集成测试在两个版本上都看到：打开 `example.svg` 之前扩展未激活，打开后立即激活。代价是打开任何 XML 文件都会激活本扩展，但激活只是注册两个 provider，不读任何文件。**`onStartupFinished`（文件标记，S1 起）**：Explorer 显示文件时并不打开它，不会触发 `onLanguage`，所以文件标记仍然依赖这一项。`*` 会拖慢启动；`onStartupFinished` 在启动完成后才激活，不阻塞窗口。`workspaceContains:**/*.svg` 要在启动时扫描整个工作区，而且工作区里原本没有 SVG、后来才新建时，扩展不会激活。晚一点注册也不会漏标记：`DecorationsService.registerDecorationsProvider` 注册时会发出“所有资源都可能变化”的事件，Explorer 会对已显示的行重新询问（VSCode 1.146.0 源码 `src/vs/workbench/services/decorations/browser/decorationsService.ts`） |
| VA2 | badge 固定为 `[]`，tooltip 为 `SVG file`；`Badge` 构造时要求 1–2 个字符（按码点计） | `FileDecoration.validate`（`src/vs/workbench/api/common/extHostTypes.ts`）遇到超过 2 个字符的 badge 会抛错。扩展宿主（`extHostDecorations.ts`）会捕获这个错误，写一条 `INVALID decoration` 警告并丢弃该装饰，结果就是所有标记悄无声息地消失。所以必须在构造 `Badge` 时就把关。按码点计数不会比 VSCode 的计数宽松。`Badge.test.ts` 检查长度，防止以后改成 `[svg]` |
| VA3 | 扩展名**不区分大小写**：`.SVG`、`.Svg` 都算 SVG | macOS 和 Windows 的默认文件系统不区分大小写，浏览器和多数工具也认 `.SVG`。VSCode 的装饰缓存本身按“忽略路径大小写”作键（同一文件中 `TernarySearchTree.forUris(… ignorePathCasing …)`），大小写无关的规则正好与之一致。watcher 的 glob 相应写成 `**/*.[sS][vV][gG]`。大纲的选择器与此一致（VA14） |
| VA4 | 名为 `.svg` 的隐藏文件**不算** SVG；`.foo.svg`、`..svg` 算 | 与 Node `path.posix.extname` 和 VSCode `resources.extname` 一致：`.svg` 是“没有扩展名的点文件”，就像 `.gitignore` 不是“扩展名为 gitignore 的文件”。`ResourcePath.test.ts` 用 12 个易误判的名字与 `path.posix.extname` 逐个对照 |
| VA5 | 符号链接看**目标**：指向文件的加标记，指向目录的不加，断开的不加；既不是文件也不是目录（socket、FIFO、设备）的不加 | `workspace.fs.stat` 跟随链接：链接到文件时是 `SymbolicLink｜File`（65），到目录时是 66，断链时是 `SymbolicLink｜Unknown`（64）（`src/vs/platform/files/node/diskFileSystemProvider.ts` 的 `toType()`）。规格说“目录不加标记”，Explorer 也把指向目录的链接显示为可展开的文件夹，所以不加。断链无法确认是不是文件，按“只标记确认的文件”处理。判断全部用 `&`（`FileTypeMask`），不用 `===` |
| VA6 | 只装饰 `file` 和 `vscode-remote` 两种 scheme；其他 scheme（`untitled`、`git`、`gitlens`、`vscode-userdata`、`output`……）在调用 `stat` **之前**就直接返回 `undefined` | 规格要的是“Explorer 中的文件”：本地工作区是 `file`，Remote-SSH / WSL / 容器窗口里的工作区是 `vscode-remote`。`untitled` 没有磁盘文件，也不在 Explorer 中；`git` 等是历史版本或其他数据的视图，标 `[]` 并不表示“工作区里有一个 SVG 文件”，而且这类文件系统的 `stat` 可能很慢（`git` 每次都要起 git 进程）。注：`vscode-remote` 是按 VSCode 的远程 URI 约定加入的，本机没有远程环境，未实测 |
| VA7 | **实现** `onDidChangeFileDecorations`：`SvgResourceWatcher` 监听 `**/*.[sS][vV][gG]` 的创建、修改、删除，并把相应的 URI 重新广播出去 | 见下文“刷新” |
| VA8 | `stat` 失败（文件刚被删除、没有权限、该 scheme 没有文件系统提供者）时返回 `undefined`，同步抛出的异常也一样；请求已被取消时返回 `undefined`；名字不符合的资源不调用 `stat` | 不让异常或未处理的 Promise 拒绝进入扩展宿主。provider 一旦 reject，扩展宿主会把错误写进日志（`extHostDecorations.ts` 中的 `this._logService.error(err)`），主线程则丢弃该条缓存，下次渲染时重新询问（`_fetchData` 的 catch）。刚删除的文件每次都这样，就会反复报错。Explorer 每显示一行都会询问一次，名字预检可以让绝大多数资源连一次 I/O 都不做 |
| VA9 | `extension.ts` 不遵守一类一文件，导出两个函数 `activate` / `deactivate` | VSCode 的扩展约定要求入口模块导出这两个函数，与 Phase 1 的 `cli/main.ts` 是同一类例外。它只组装和注册，不含逻辑；architecture test 限制它只能导出这两个名字 |
| VA10 | TypeScript 7.0.2，只用于类型检查（`tsc --noEmit`）；esbuild 0.28.2 负责打包成 CJS，目标 `node18`；`engines.vscode` 为 `^1.85.0`，`@types/vscode` 为 `1.85.0`；`engines.node` 保留 `>=22` | TS 版本与根目录 CLI 相同，两边的类型检查行为一致。本工程不调用 TS Compiler API，不受 TS 7 只有 `unstable/*` 接口的影响；编译由 esbuild 完成，所以采用 `module: preserve` 加 `moduleResolution: bundler`，并开启 `verbatimModuleSyntax`，保证 `import type` 在打包时被擦除（`VscodeResourceKindReader` 运行时不加载 `vscode`）。**最低版本**：S1 写的是本机的 1.146.0，S1 独立验收指出这会让任何更旧的 VSCode 拒绝安装。现在降到 1.85.0（2023 年 11 月，比 1.146 早约三年）：下文“API 清单”中的每一项在 1.85 都已存在，证据有两条，一是 `@types/vscode` 换成 1.85.0 后类型检查通过（该版本的 `vscode.d.ts` 只声明 1.85 已有的 API），二是集成测试在下载的 1.85.0 上实际通过（`VSCODE_TEST_VERSION=1.85.0`）。清单里的 API 大多在 1.85 之前很久就有了，再往下降收益很小，而每降一个版本都要实测。**构建目标**：1.85 自带 Electron 25.9.7，扩展宿主是 Node 18.15（集成测试打印 `process.versions.node` 确认），所以 esbuild 目标降为 `node18`。esbuild 只转换语法、不补 API，所以另有两条保证：`src/` 不导入任何 Node 内置模块（architecture test 检查），类型库停在 Node 18 完整实现的 ES2022（同上）；最终由 1.85 上的集成测试证明。**`engines.node`**：VSCode 不读这个字段，扩展宿主的 Node 由 VSCode 版本决定；它约束的是开发工具链（vitest 5.1.0 要求 Node `^22.12.0`、`^24` 或 `>=26`，`@vscode/test-electron` 3.1.0 要求 `>=22`），所以保留。`manifest.test.ts` 检查：两个版本一致、不高于 1.146、最低版本为 1.85.0、构建目标为 `node18` |
| VA11 | 不加 LICENSE 文件，`package.json` 不写 `license` 字段；vsce 打包时只给警告 | 用什么许可证是作者的决定，仓库根目录也没有 LICENSE。vsce 4.1.1 实测：缺 LICENSE 只报 WARNING，照常生成 `.vsix`；`repository` 字段已补上 |
| VA12 | 声明 `"capabilities": { "untrustedWorkspaces": { "supported": true } }`：受限模式（工作区未受信任）下照常激活 | 没有声明这一项的**已安装**扩展，在受限模式下会被 VSCode 禁用；开发模式（F5、集成测试）加载的扩展不受这条规则约束，所以 F5 看不出来（S1 独立验收发现：截图中的测试窗口正处于受限模式）。也就是说，助教装上 `.vsix` 后打开一个还没信任的文件夹，可能什么效果都看不到。受限模式要防的是“打开别人的仓库时自动执行其中的代码”（任务、调试配置、语言服务器、工作区里的可执行文件）。本扩展只做三件事：用 `workspace.fs.stat` 读文件类型；用文件监听得到 `*.svg` 的路径；在内存里解析 VSCode 已经读入的文本。它不执行、不加载工作区中的任何东西，也不读任何设置，所以可以无条件支持。`manifest.test.ts` 检查这一项。实际效果用 `npm run test:restricted` 验证，1.146.0 和 1.85.0 都通过：把 `vsce package` 的产物装进临时的 `--extensions-dir`，打开从未受信任的临时文件夹（`workspace.isTrusted` 为 `false`），扩展从安装目录加载、激活并提供大纲；去掉 `capabilities` 的对照包在同样的窗口里根本不出现在 `extensions.all` 中（被禁用），大纲为空（见“集成测试”） |
| VA13 | 解析：自己写一个面向对象的小型分词器（`XmlTokenizer`），不引入运行时依赖 | 大纲需要每个元素从起始标签的 `<` 到结束标签的 `>` 的精确区间，而 Phase 1 用的 `@xmldom/xmldom` 只给起始位置。备选是能报告位置的 SAX 解析器（如 `saxes`）。但它报告的是事件发生时的位置（读完 `>` 之后），起始标签的 `<` 要自己倒推；它在出错时抛异常，想拿到“出错之前的部分”（VA16）还得自己维护元素栈。这样一来，要写的代码并不少，还要把依赖打进 `dist/extension.js`，并核对它能否在 Node 18 上运行（VA10）。大纲只需要起始标签、结束标签和它们的位置，其余内容（文本、注释、CDATA、处理指令、DOCTYPE）一律跳过，用不到实体展开、命名空间解析和 DTD。手写分词器约 200 行，覆盖规格列出的全部情形：注释、CDATA、`<?xml?>`、带内部子集的 DOCTYPE、自闭合标签、属性值中的 `>`。没有运行时依赖，Node 18 兼容性只取决于自己的代码。单元测试覆盖每种结构和每种出错位置，并对 `example.svg` 的全部前缀、全部单字符删除、随机字节和随机 XML 标点做模糊测试 |
| VA14 | 选择器 `{ language: "xml", pattern: "**/?*.[sS][vV][gG]" }`，两个条件同时满足 | 只按语言选：观察表第 1–3 项说明 `.svg` 都是 `xml`，可普通 `.xml` 文件也是 `xml`，也会得到一份“SVG 大纲”。只按文件名选：其他扩展把 `.svg` 关联到别的语言时，两份大纲会同时出现。两者结合：文件名决定“是不是 SVG”（与 A.1 同一套规则），语言决定“是不是还归内置的 XML 管”。glob 默认区分大小写，所以写成 `[sS][vV][gG]`，与 watcher 一致（VA3）。`?*` 要求 `.svg` 前至少有一个字符，所以隐藏文件 `.svg` 不算（VA4；集成测试实测它的语言 ID 也是 `xml`，光靠语言挡不住），`..svg`、`.foo.svg` 算。**边界**：其他扩展把 `.svg` 关联到语言 `svg` 等时，本扩展不提供大纲，让位给那个扩展；用户如果仍想要本扩展的大纲，可以用 `files.associations` 把 `*.svg` 改回 `xml`（激活仍有 `onStartupFinished` 兜底）。集成测试：`example.svg`、`LOGO.SVG`、`Mixed.Svg` 有大纲，`plain.xml`、`.svg` 没有 |
| VA15 | 大纲不限制 scheme：`file`、`untitled`、`git`、`vscode-remote`、`vscode-vfs` 等，只要名字和语言符合就提供。这与 VA6 不同 | VA6 限制 scheme 的两条理由在这里都不成立。一是开销：大纲只解析 VSCode 已经读入内存的文本，没有 `stat` 之类的 I/O。二是含义：大纲跟着编辑器走，不表示“工作区里有一个 SVG 文件”；`git:` 的历史版本、差异编辑器、还没保存的 `untitled:…/new.svg` 都用得上。没有路径的 `untitled:Untitled-1` 不符合文件名模式，没有大纲。集成测试：带 `.svg` 名的 untitled 文档有大纲，`Untitled-1` 没有 |
| VA16 | XML 不完整时，返回**出错位置之前**已经解析出的部分：出错前已完成的元素照常显示，还没闭合的祖先元素也显示，它们的区间截到出错位置；出错处及之后的元素暂时不显示 | 规格允许清空，但观察表第 8、9 项显示，原生大纲在编辑过程中不会整树清空（JSON 不完整时显示临时的解析结果）。最常见的编辑是在中间插入新元素：输入到一半时，出错位置正好是新元素的 `<`，它之前的整棵树保持不变，所以大纲不闪烁，也不丢失折叠状态。出错位置取出问题的结构的起点，包括：未闭合的注释、CDATA、处理指令、DOCTYPE、标签和属性值，非法的标签名，不匹配或多余的结束标签，以及文本结束时仍未闭合的元素。属性值中不允许出现 `<`（与 XML 相同），所以漏掉右引号的属性值会停在下一个标签，而不是吞掉文件的其余部分。**不做的校验**（它们不影响结构）：文本中的实体、重复属性（取第一个）、多个顶层元素（都作为根显示）、根元素之外的文本 |
| VA17 | 显示名：有非空 `id` 时为 `标签名#id`，否则为 `标签名`；标签名照源码原样，带命名空间前缀（`svg:rect`）；`id` 取解码后的值 | 规格要求显示 `标签名#id` 或 `标签名`。`id=""` 和全是空白的 `id` 都不是有效标识，显示成 `rect#` 会像出了错，所以按没有 id 处理。前缀原样保留：大纲反映源码，用户在源码里搜到的就是 `svg:rect`，本扩展也不解析命名空间（VA13）。`id` 按 DOM 的 `getAttribute` 解码：先做属性值规范化（字面的制表符、换行变成空格），再展开五个预定义实体和字符引用，所以 `a&amp;b` 显示为 `a&b`；未知实体（如 `&nbsp;`）和非法的字符引用原样保留。只认不带前缀的 `id`，`xml:id`、`ID` 都不算 |
| VA18 | `SymbolKind`：根元素为 `Module`，容器为 `Namespace`，叶子为 `Field`。“容器”按结构判断：至少有一个子元素的非根元素 | 参照观察表第 9 项 JSON 大纲的做法：外层容器用 `Module`，内容节点用值的种类。SVG 元素没有值的种类，叶子就用 `Field`（容器中的一个成员）；`g` 是分组作用域，用 `Namespace`。按结构而不按标签名判断，就不需要 SVG 词汇表（规格不要求完整的 SVG 校验）：`<text>` 里有 `<tspan>` 时也是容器，空的 `<g/>` 是叶子。注意 `Module` 和 `Namespace` 在 codicon 中是同一个图标（都是 `0xea8b`），`Field` 是 `0xeb5f`；种类上的区别主要体现在“转到编辑器中的符号”输入 `:` 后的分组里 |
| VA19 | `range` 为整个元素：从起始标签的 `<` 到结束标签的 `>`，自闭合标签就是它本身。`selectionRange` 为起始标签中的标签名 | `range` 供“跟随光标”和面包屑使用：光标在元素内的任何位置（包括子元素和结束标签）都归属这个元素。`selectionRange` 决定点击节点后光标落在哪里：观察表第 6 项实测 Markdown、JSON 都把光标放在 `selectionRange` 的起点，不选中文字（JSON 落在键名的开引号处），这也是 LSP 对 `selectionRange` 的约定（通常是名字）。取标签名的话，点击 `rect#start` 后光标在第 3 行 `<rect` 的 `r` 之前，与图 A.2 的“定位到第 3 行”一致。标签名一定在起始标签内，起始标签一定在 `range` 内，所以 `selectionRange ⊆ range` 由构造保证；`OutlineNode` 的构造函数还会再检查一遍 |
| VA20 | `detail` 为空 | 图 A.2 中没有附加信息，`id` 已经在名字里。显示其他属性（如 `x`、`fill`）会让大纲随每次编辑而变动，信息量却不大 |
| VA21 | 只有元素进大纲；文本、注释、CDATA、处理指令（包括 `<?xml?>`）、DOCTYPE 都不进 | 规格要的是“元素的嵌套层级”。这些内容在分词阶段就被跳过，其中出现的 `<rect/>` 之类的字样也不会被当成元素（单元测试覆盖） |
| VA22 | provider 永不抛错，也不返回 Promise；请求已取消时返回空；嵌套超过 256 层的元素不进大纲 | provider 同步执行，整个过程包在 `try/catch` 里：意外异常写一行以 `[svg-badge] SVG outline failed` 开头的日志，返回空大纲。同步返回意味着没有可以被拒绝的 Promise。不完整的 XML 不算异常（VA16）。**取消**：解析前、转换前各检查一次 `CancellationToken`。同步代码执行到一半时看不到新到的取消请求，而解析是线性的（单元测试：10 万个元素约 0.1 s；集成测试：5 万个元素、260 万字符的一次查询约 0.2 s），所以不切成异步分块。**深度**：解析和转换都用显式栈，本身不怕深；但集成测试发现，VSCode 自己递归转换符号树，1.85.0 在 1000–1250 层之间、1.146.0 在 1500–2000 层之间栈溢出，整个大纲随之变空。所以第 256 层以下的元素照样检查标签配对，但不进大纲，余量在 4 倍以上；真实的图形远到不了这个深度 |

### 刷新（VA7）的依据

- VSCode 的 `DecorationsService` 按 URI 缓存每个 provider 的结果，**“没有标记”也会被缓存**（`_keepItem` 把 `undefined` 存成 `null`）。缓存只在 provider 触发 `onDidChange` 时才丢弃并重新询问。源码见 VSCode 1.146.0 的 `src/vs/workbench/services/decorations/browser/decorationsService.ts`，具体是 `registerDecorationsProvider`、`getDecoration`、`_fetchData`、`_keepItem` 四处。
- 因此：
  - **`a.txt` 重命名为 `a.svg`**：`a.svg` 是一个新 URI，缓存中没有它的结果，VSCode 会询问 provider，标记会正确出现，**不需要**刷新事件。新建 `x.svg` 目录同理，询问时 `stat` 得到目录，不会加标记。
  - 但**同一个 URI 换了类型**时（删掉文件 `x.svg` 再 `mkdir x.svg`，或者反过来），缓存中的旧结果会一直留着，**需要**刷新事件。同样的情况还有：某次询问恰好赶上文件正在创建，`stat` 失败，“无标记”也被缓存下来。
- 只监听创建和删除还不够：VSCode 的文件监听会把同一路径“删除后紧跟创建”的**事件类型**合并成“修改”（`src/vs/platform/files/common/watcher.ts` 的 `EventCoalescer`：“Flatten DELETE followed by CREATE into CHANGE”）。所以修改事件也要转发，代价是每次保存 SVG 文件时多一次 `stat`。
- 但**事件的数量不保证是一次**。S1 独立验收在真实的 VSCode 1.146.0（macOS）上实测：类型确实被合并成 `change`，但每一次文件操作都会收到两次相同的事件，间隔约 100 ms，创建和删除也一样，原因未查明。重复转发是无害的：VSCode 只是对同一个 URI 再询问一次，代价是多一次 `stat`，结果不变。所以实现不去重，也不依赖事件的次数。
- 仍然覆盖不到的情况（已知限制）：符号链接的**目标**变了而链接本身没变（例如 `link.svg` 指向的文件被删除），事件只会落在目标路径上，链接的标记不会更新，要等重新加载窗口。
- 实测：F5 清单中的 R1–R5。
