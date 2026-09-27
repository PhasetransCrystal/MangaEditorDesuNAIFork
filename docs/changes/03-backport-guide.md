# 详细修改文档（Backport 施工单）

用途：把本次「导出分辨率 / 导出格式 / 文本聚焦」三个特性移植到更早的分支（含 fork 起点 `3f63362`）。
基线参照：本仓库当前 `HEAD`。移植前请先 `git fetch` 并核对目标分支的锚点上下文，行号仅作定位参考。

## 0. 移植总览

| 顺序 | 文件 | 动作 | 依赖 |
| --- | --- | --- | --- |
| 1 | `js/core/util/png-bit-depth.js` | **整文件新增**（后端纯函数） | 无 |
| 2 | `js/core/util/fabric-text-focus.js` | **整文件新增** | fabric 已加载 |
| 3 | `js/core/manga-page-size.js` | 追加计算函数 + 扩展导出对象 | 无 |
| 4 | `js/core/util/image-util.js` | 追加常量/函数 + 改造导出编排 | 1、3 |
| 4b | `js/core/compression/project-compression.js` | 预览调用改 `await` + q0.8（见 §12） | 4 |
| 5 | `js/canvas-manager.js` | 追加 UI 同步函数 + 接线 | 3、4 |
| 6 | `js/project-management.js` | schema 默认值 + 加载/保存钩子 | 3 |
| 7 | `index.html` | 菜单 DOM + script 标签 + 版本号 | 1、2 |
| 8 | `css/layout.css` | 新增菜单行样式 | 7 |
| 9 | `js/ui/third/base-translation/base-*.js` | 8 语言文案键 | 7 |
| 10 | `scripts/*`、`package.json` | 测试与 npm 脚本（可选，建议随特性一起移植） | 全部 |
| 11 | 见 §10.5 | 后续一致性修复（常量单一来源 / 去重 / 监听守卫） | 1~7 |

**移植注意**：目标分支若没有 `llm_doc/`，请忽略本次提交中 `llm_doc/**` 的改动（那是索引生成器产物，非功能必需）。

---

## 1. `js/core/util/png-bit-depth.js`（新增文件，约 583 行）

- 动作：把当前 `HEAD` 的该文件 **整文件复制** 到目标分支同路径。
- 导出：`window.NaiPngBitDepth = { MODES, DEFAULT_MODE, normalizeMode, resolveExportMode, describeMode, encodePngBytes, encodePngDataUrl, __internals }`。
- 依赖：浏览器需 `DecompressionStream`/`CompressionStream`；Node（测试）下回退 `require('zlib')`。
- 用途：真正重写 PNG 的 IHDR/IDAT，实现灰度 / 24位 RGB / 32位 ARGB。
- 无需改目标分支其它文件，但 `index.html` 必须新增它的 `<script>`（见第 7 节）。

## 2. `js/core/util/fabric-text-focus.js`（新增文件，约 74 行）

- 动作：整文件复制。
- 导出：`window.NaiFabricTextFocus = { install, patchedFlag }`。
- 用途：包装 `IText/Textbox/Text.prototype.initHiddenTextarea`，强制 `preventScroll`。
- 关键点：`patchTextPrototype` 用 `hasOwnProperty('initHiddenTextarea')` 判断，避免对继承者二次包装；**不修改坐标计算**以保 IME 位置。
- 加载顺序要求：必须在 fabric 之后、且 **非 defer**（当前 `index.html:2593` 即无 `defer`），否则补丁安装时 fabric 尚未就绪。

## 3. `js/core/manga-page-size.js`（在既有 IIFE 内追加）

基线仅有 `DPI/MAX_EDGE/MIN_EDGE`、`mmToPx/clampEdge/resolveMangaPageSize/defaultMangaPageSize/label`，导出对象在基线第 `49` 行结束。移植时：

1. 在导出对象 **之前** 追加以下符号（当前 `HEAD` 行号供对照拷贝）：
   - `npm` 常量：`PAGE_MM`(10)、`EXPORT_DPI_MIN/MAX/DEFAULT`(15-17)、`EXPORT_MAX_EDGE/PIXELS`(124-125)。
   - 函数：`isLandscapeSize`、`pageMillimeters`、`pageMillimetersForSize`、`resolveExportDpi`(71)、`normalizeExportDpi`(83)、`pixelsForDpi`(93)、`dpiForPixelAxis`(102)、`multiplierForLongEdge`(128)、`exportMaxLongEdge`(138)、`planExportPage`(156)、`exportLongEdgeForDpi`(196)、`resolveDpiForPixelEdge`(202)。
2. 扩展尾部导出对象（`HEAD:230` 起）加入以上所有键。
3. 注意基线注释/编码为 **UTF-8**，避免编辑器改写字符集。

- 用途：DPI→倍率→输出像素的**唯一口径**；DPI↔像素反解；导出上限求解。

## 4. `js/core/util/image-util.js`（核心编排改造）

### 4.1 文件头常量（插在 `var ImageUtil={` 之前）
- `EXPORT_MAX_EDGE/EXPORT_MAX_PIXELS`：**不要在此重定义字面量**，改为引用 `NaiMangaPageSize`（见 §10.5.1）。
- 其余新增：`EXPORT_FORMATS`、`EXPORT_BIT_DEPTHS/DEFAULT`、`EXPORT_QUALITY_MIN/MAX/DEFAULT`、`EXPORT_ESTIMATE_*`。
- 另需在同一区域新增模块级 `restoreGridAfterExport()`（见 §10.5.2）。

### 4.2 新增函数（追加到对象内，紧邻既有导出函数）
- `resolveExportFormat`(397)、`resolveExportMultiplierForDpi`(406)、`resolveExportBitDepth`(426)、`resolveExportBackground`(438)、`encodeExportPng`(467)、`normalizeExportQuality`(477)、`resolveExportMultiplier`(489)、`exportDataUrlByteLength`(506)、`formatByteSize`(519)、`estimateExportSize`(529)、`exportCanvasDataURL`(597)、`notifyExportLimitReached`(607)、`getExportBitDepthForFormat`(615)、`getExportBackgroundColor`(622)、`buildDownloadLink`(646)。

### 4.3 改造既有函数（基线对照）
| 基线函数 | 基线行 | 改造 |
| --- | --- | --- |
| `canvas2DataURL` | 362 | 改为转发 `ImageUtil.exportCanvasDataURL(multiplier,format)` |
| `getCropAndDownloadLinkByMultiplier` | 366 | 加 `quality,bitDepthOverride` 形参；经 `exportCanvasDataURL`；非 `argb` 的 PNG 走 `encodeExportPng`；抽出 `buildDownloadLink`；**改为返回 `Promise<HTMLAnchorElement>`** |
| `getCropAndDownloadLink` | 385 | 加 `forcedFormat` 形参；倍率改为 `resolveExportMultiplierForDpi(outputDpi, canvas.width, canvas.height)`（取代 A5 硬编码） |
| `clipCopy` | 403 | 改为 Promise 链；固定 `'png'` + `'argb'`，经 `getCropAndDownloadLinkByMultiplier` |
| `cropAndDownload` | 431 | 改为 `.then(link=>link.click()).catch(...)`，成功后再 `notifyExportLimitReached()` |

### 4.4 尾部全局导出别名（基线 `529` 起共 30 行；当前 `HEAD:810` 起共 50 行）
- 追加：`resolveExportFormat`、`normalizeExportQuality`、`resolveExportMultiplier`、`resolveExportMultiplierForDpi`、`resolveExportBitDepth`、`resolveExportBackground`、`encodeExportPng`、`exportDataUrlByteLength`、`formatByteSize`、`estimateExportSize`、`exportCanvasDataURL`。

- **破坏性变更**：`getCropAndDownloadLink*` 由同步返回 `<a>` 变为返回 Promise。目标分支若有其它调用方（基线中为 `js/core/compression/project-compression.js:41`、`js/shortcut.js:202`、`js/core/util/share-util.js:10`），需一并适配（`project-compression` 需 `await`）。

## 5. `js/canvas-manager.js`（UI 同步与接线）

### 5.1 新增函数（追加到文件内，与既有函数并列）
`bindExportBackgroundButton`(206)、`syncExportBackgroundLabel`(220，`formatExportColorHex` 已并入，见 §10.5.4)、`syncExportBitDepthState`(233)、`currentExportDpi`(262)、`exportDpiFallback`(273)、`normalizeExportDpiInput`(279)、`setExportDpi`(285)、`currentCanvasSizeForPreview`(299)、`exportPlanForOrientation`(312)、`updateExportPagePlanDisplay`(324)、`syncExportDpiField`(344)、`syncExportPagePlan`(361)、`commitExportPixelEdge`(377)、`notifyExportPixelRange`(413)、`notifyExportDpiRange`(424)、`commitExportDpi`(436)、`bindExportPagePlanEvents`(458)、`syncExportQualityAvailability`(514)、`renderExportSizeEstimate`(538)、`scheduleExportSizeEstimate`(608)、`syncExportSizeEstimate`(616)。
以及模块级状态：`exportPagePlanSyncing`(251)、`exportPixelEditing`、`exportDpiEditing`、`lastValidExportDpi`(258)、`exportEstimateTimer/Running/Pending`(531-533)、`exportEstimateCanvasBound`(536，见 §10.5.3)。

### 5.2 接线点（编辑既有代码）
- `resizeCanvasByNum` 末尾的 `fitCanvasViewToContainer(true);` 之后 → 追加 `syncExportPagePlan(); scheduleExportSizeEstimate();`（基线 `100` → 当前 `HEAD:101-102`）。
- `resizeCanvas` 末尾同理：`fitCanvasViewToContainer(true);` 之后追加同样两行（基线 `138` → 当前 `HEAD:141-142`）。
- `resizeCanvasToObject` 末尾同理：`fitCanvasViewToContainer(true);` 之后追加两行（基线 `178` → 当前 `HEAD:183-184`）。注意此函数体内还有一处 `syncExportPagePlan()`（`HEAD:201`）属 `syncExportBitDepthState` 路径，勿混。
- DOMContentLoaded 钩子（基线 `181-189`，当前 `HEAD:187` 起）内追加：`bindExportBackgroundButton(); syncExportBackgroundLabel(); syncExportBitDepthState(); syncExportQualityAvailability(); syncExportPagePlan(); syncExportSizeEstimate();`。
- `bg-color` 的 `input` 监听回调内追加 `syncExportBackgroundLabel();`。

## 6. `js/project-management.js`

- schema（基线 `193`）：`canvasDpi.default` 由 `'450'` 改 `'300'`；新增 `outputImageFormat`(png)、`outputBitDepth`(rgb)、`outputImageQuality`(0.92)。
- 新增 `syncExportPlanAfterSettingsLoad`(399)，并在 `loadSettingsLocalStrage` 的两个返回路径（基线 `405` 附近、`519` 附近）各调用一次。
- 新增 `sanitizeSettingsValueForStorage`(538)；`saveSettingsLocalStrage`(当前 `HEAD:551`，基线 `522`) 中改为 `data[key]=sanitizeSettingsValueForStorage(cfg,el,previous?previous[key]:undefined)`，并在循环前读取 `previous`。

## 7. `index.html`

- 画布下拉菜单（基线 `navbarDropdownCanvas` 的 `<ul>`，约 `424`）：整段替换为 `HEAD:426-500` 的内容（即 `<label canvasDisplay>` 到 `<label canvasGrid>` 之前），新增：
  - 背景行 `bgColorButton/bgColorValue/bgColorSwatch` + `canvasBGAlphaNote` 备注；
  - `outputDpi` 增加 `max="1800"`、`step="0.01"`；
  - 竖图/横图像素行 `exportPxPortraitWidth/Height`、`exportPxLandscapeWidth/Height` + `exportPxCappedNote`；
  - `导出` 分组标签；
  - `outputImageFormat`、`outputBitDepth` + `outputBitDepthHint`、`outputImageQuality`；
  - `outputImageEstimateRow/outputImageEstimate`。
- script 标签：新增 `js/core/util/png-bit-depth.js?v=1.0" defer`（`HEAD:2554`，紧随 `manga-page-size.js`）；新增 `js/core/util/fabric-text-focus.js?v=1.0"`（`HEAD:2593`，**无 defer**，紧随 `fabric-util.js`）。
- 版本号抬升：`manga-page-size.js` → `v=1.2`、`image-util.js` → `v=7.7`、`canvas-manager.js` → `v=8.6`、`project-management.js` → `v=8.18`（缓存失效用）。
- 依赖顺序不变式：`manga-page-size` → `png-bit-depth` 先于 `image-util` 与 `canvas-manager`。

## 8. `css/layout.css`

- 在文件末尾附近追加 `HEAD:423-497` 的规则：`.nai-bg-item input.jscolor-color-picker`、`.nai-bg-button(:hover)`、`.nai-bg-value`、`.nai-bg-swatch`、`.nai-bg-note`、`.nai-px-note`、`.nai-px-times` 等。
- 用途：把背景输入本体（1px 不可见）视觉上隐藏，改为点击整行按钮唤起 jscolor；像素行与备注排版。

## 9. 语言文件（`js/ui/third/base-translation/base-*.js`）

- 8 个文件（zh/en/ja/ko/fr/ru/es/de）各追加 13 个键：
  `outputImageFormat`、`outputBitDepth`、`bitDepthRgb`、`bitDepthArgb`、`bitDepthGray`、`outputBitDepthHint`、`outputImageQuality`、`outputImageEstimate`、`canvasExport`、`canvasBGAlphaNote`、`outputPortraitPx`、`outputLandscapePx`、`outputPxCappedNote`。
- 参考位置：`js/ui/third/base-translation/base-zh.js:482-494`、`js/ui/third/base-translation/base-en.js:476-488`。

## 10. 测试与脚本（可选但建议）

- 新增：`scripts/image-export-smoke-test.cjs`、`scripts/image-export-integration-test.cjs`、`scripts/png-bit-depth-smoke-test.cjs`、`scripts/fabric-text-focus-smoke-test.cjs`，并更新 `scripts/manga-page-size-smoke-test.cjs`。
- `package.json` 追加别名：`test:image-export`、`test:image-export-integration`、`test:png-bit-depth`、`test:fabric-text-focus`、`test:page-size`。
- 移植后验证（应在目标分支全部通过）：
  `npm run test:image-export && npm run test:image-export-integration && npm run test:png-bit-depth && npm run test:fabric-text-focus && npm run test:page-size`。

## 10.5 后续一致性修复（提交 `47e243c`，建议与功能一并 backport）

若只 backport 功能而漏掉这一提交，会出现"能跑但会隐蔽失配/泄漏"的状态。三处改动：

### 10.5.1 导出上限常量：改为单一来源
- 目标分支若把 `EXPORT_MAX_EDGE/EXPORT_MAX_PIXELS` 直接写在 `image-util.js` 里，请改为引用 `NaiMangaPageSize`：
  ```
  var EXPORT_MAX_EDGE=typeof NaiMangaPageSize!=="undefined"&&NaiMangaPageSize.EXPORT_MAX_EDGE
  ?NaiMangaPageSize.EXPORT_MAX_EDGE
  :8192;
  var EXPORT_MAX_PIXELS=typeof NaiMangaPageSize!=="undefined"&&NaiMangaPageSize.EXPORT_MAX_PIXELS
  ?NaiMangaPageSize.EXPORT_MAX_PIXELS
  :40*1000*1000;
  ```
- `manga-page-size.js` 侧保留唯一定义并更新注释（说明不要在别处重定义）。
- **前置条件**：`manga-page-size.js` 必须早于 `image-util.js` 加载，否则引用退避到同值默认（行为不变，但失去"单一来源"意义）。

### 10.5.2 网格恢复去重
- 在 `image-util.js` 顶部常量区之后新增模块级函数：
  ```
  function restoreGridAfterExport(){
  if(isGridVisible){
  drawGrid();
  isGridVisible=true;
  }
  }
  ```
- 删除 `clipCopy` 内的 `function restoreGrid(){...}`，把结尾 `.then(restoreGrid)` 改为 `.then(restoreGridAfterExport)`。
- 删除 `cropAndDownload` 内的同名局部函数，把两处 `restoreGrid()` 调用改为 `restoreGridAfterExport()`。
- **语义不变**：仍依赖全局 `isGridVisible`/`drawGrid`。

### 10.5.3 canvas 监听加守卫（P4，重要）
- 在 `canvas-manager.js` 的 `exportEstimateTimer/Running/Pending` 旁新增 `var exportEstimateCanvasBound=false;`。
- 把 `syncExportSizeEstimate()` 内的 `canvas.on(...)` 段改为：
  ```
  if(!exportEstimateCanvasBound&&typeof canvas!=='undefined'&&canvas&&canvas.on){
  exportEstimateCanvasBound=true;
  ['object:added','object:modified','object:removed'].forEach(function(eventName){
  canvas.on(eventName,function(){scheduleExportSizeEstimate();});
  });
  }
  ```
- **为什么必须**：不修则每次调用 `syncExportSizeEstimate`（启动至少 2 次 + 每次切换导出格式 1 次）都新增一组监听，长期会话持续累积。功能靠 350ms 防抖掩盖，属隐蔽缺陷。

### 10.5.4 小清理（可选）
- 删除 `canvas-manager.js` 的 `formatExportColorHex` 薄包装，`syncExportBackgroundLabel()` 直接写
  `var hex=typeof rgbToHex==='function'?rgbToHex(String(picker.value||'')).toUpperCase():String(picker.value||'').toUpperCase();`

## 11. 容易踩错的点

1. **Promise 化**：忘记 `await`/`.then` 处理 `getCropAndDownloadLink*`，会导致 `link.click()` 报错。
2. **脚本顺序**：`png-bit-depth.js` 必须是 `defer` 且早于 `image-util.js`；`fabric-text-focus.js` 必须无 `defer`。
3. **默认位深度**：目标分支若沿用 `rgb` 默认，普通 PNG 导出会丢透明度（见审查文档 [P1]）；如需保透明，默认改 `argb`。
4. **常量单一来源**：`EXPORT_MAX_EDGE/PIXELS` 只在 `manga-page-size.js` 定义，`image-util.js` 必须引用而非重定义（§10.5.1）。
5. **缓存版本号**：不改 `?v=` 会造成浏览器沿用旧脚本。
---

## 12. `js/core/compression/project-compression.js`（配套修改）

- 基线第 `41` 行：`var previewLink=getCropAndDownloadLinkByMultiplier(1,'jpeg');`。
- 改为：`var previewLink=await getCropAndDownloadLinkByMultiplier(1,'jpeg',0.8);`（外层函数已是 `async`）。
- 原因：第 4 节已把 `getCropAndDownloadLinkByMultiplier` 改为返回 `Promise`，此处必须 `await`；同时把工程预览缩略图从隐式无损改为 **JPEG q0.8**，减小 `.lz4` 体积。
- 漏改后果：`previewLink` 变成 Promise，`previewLink.href` 为 `undefined`，保存工程会写入损坏预览。
