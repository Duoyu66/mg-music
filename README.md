# MuGuaMusic

基于 **pnpm** + **Electron** + **Vue 3** + **TypeScript** + **Element Plus** 的跨平台本地音乐播放器，一套代码可在 **Windows** 与 **macOS** 上运行与打包。

## 环境要求

- Node.js 20+（推荐 LTS）
- pnpm 9+（项目指定 `packageManager`: `pnpm@10.30.2`）

## 安装与运行

```bash
pnpm install
pnpm dev
```

开发模式下会打开 DevTools，主窗口最小宽度 **800px**。

### 在线音乐接口（与 web_f 同源后端）

- 界面中间区域可切换 **「在线音乐」**，请求路径与旧项目 `web_f/src/api/f/music.ts` 一致（如 `/api/music/getMusicHomeInfo`）。
- **环境变量**：`pnpm dev` 只读取 **`.env.development`**；`pnpm build` / 打包读取 **`.env.production`**。只改 `.env.production` 时，开发模式仍会走下面「本地代理」逻辑，直到你在 **`.env.development`** 里设置 `VITE_API_BASE`（例如与线上一致）并**重启 dev**。
- **开发且 `VITE_API_BASE` 为空**：Vite 将 `/api` 代理到 `http://localhost:8082`，并对路径做 **`/api` → 去掉前缀**（与 web_f `craco` 里 `pathRewrite: { '^/api': '' }` 一致）。本机未起后端时会一直无数据。
- **开发或打包且 `VITE_API_BASE` 已填**：直连该域名，请求形如 **`https://域名/api/music/...`**；**后端需配置 CORS**，允许来源如 `http://localhost:9000`（开发）及 Electron 打包后的来源。

#### 跨域（CORS）

- **推荐**：在 **Nginx / Spring** 为接口增加 CORS，例如 Spring Boot：
  - 全局：`WebMvcConfigurer` 里 `registry.addMapping("/api/**").allowedOriginPatterns("http://localhost:*", "https://你的域名")`（按需加 `file://`/`null` 视 Electron 版本而定），并允许 `POST`、`OPTIONS` 与 `Authorization`、`Content-Type` 等请求头。
  - 或控制器上 `@CrossOrigin`。
- **客户端已做兜底**：主进程对 **XHR/fetch** 响应在**缺少** `Access-Control-Allow-Origin` 时会补全常用 CORS 头，便于在**暂时改不了后端**时联调；正式环境仍建议以服务端配置为准。

## 脚本说明

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 启动 electron-vite 开发环境 |
| `pnpm build` | 编译主进程、preload、渲染进程到 `out/` |
| `pnpm pack` | 构建并生成当前平台的未封装目录（`release/` 下） |
| `pnpm dist` | 构建并打正式安装包（Mac: DMG+ZIP；Windows 见下文） |
| `pnpm typecheck` | Vue / TS 类型检查 |

## 打包说明（双端）

主进程在 `electron.vite.config.ts` 中关闭了 `externalizeDeps`，将 `music-metadata`、`electron-store` 等打进 `out/main/`，避免安装包内 `node_modules` 不完整导致运行时缺模块。

1. 执行 `pnpm build` 确保 `out/` 产物完整（含 `out/main/` 下主入口与各 chunk）。
2. 执行 `pnpm dist`（或 `pnpm pack` 仅测试目录包）。
3. 安装包输出目录为 **`release/`**（由 `electron-builder` 的 `directories.output` 配置）。

### Windows

- 默认生成 **NSIS** 安装包（`pnpm run dist:win`）。在 **macOS 上交叉编译** 时**不要**把 **MSI** 放进 `build.win.target`：MSI 依赖 WiX/Wine，在 Apple Silicon / 新版 macOS 上常会失败。
- 若需要 **MSI**，在 **Windows 本机或 CI（windows-latest）** 执行：`pnpm run dist:win-msi`（需自行把 `msi` 加回 `package.json` → `build.win.target`，或仅用 CLI：`pnpm exec electron-builder --win msi`）。
- 可在 NSIS 配置中修改安装目录、桌面快捷方式等（见 `build.nsis`）。

### macOS

- 生成 **DMG** 与 **ZIP**（`build.mac`）。
- 正式发布需在 Apple 开发者账号下配置 **代码签名与公证**；本地测试可直接运行 `release/` 内 `.app`。

### 自动更新

- 使用 `electron-updater`，需在 `package.json` 的 `build.publish` 中配置你的更新服务器（如 Generic HTTP、GitHub Releases 等）。未配置时，「检查更新」可能提示无法连接或已为最新版本。

## 功能概览（已实现）

- 本地文件夹导入（mp3 / flac / wav / m4a），`music-metadata` 解析标签与封面（封面缓存于用户目录 `covers/`）。
- 按歌手、专辑、文件夹浏览；自定义歌单（新建 / 重命名 / 删除）；歌单内 **拖拽排序**；将当前列表批量加入歌单。
- 搜索、双击播放、底部播放栏、进度条、音量与静音（设置持久化）。
- 循环模式：列表循环 / 单曲循环 / 随机 / 顺序（不循环）。
- 同目录 **LRC** 歌词匹配、滚动与高亮；歌词字号与深浅色主题下颜色可配置。
- 浅色 / 深色 / 跟随系统；关闭窗口最小化到托盘（可关）；**Windows 托盘菜单**；**全局快捷键**（Ctrl/Cmd + 方向键，可在设置中关闭）。
- 最近播放记录与清空；错误提示（Element Plus 消息）；手动检查更新。

## 测试说明（简要）

建议在 **Windows 10+** 与 **macOS 12+** 分别验证：

1. `pnpm dev` 启动无报错，导入含多首歌曲的文件夹，观察扫描进度与列表。
2. 播放、暂停、切歌、拖动进度、音量、循环模式、歌词与主题切换。
3. 创建歌单、拖拽排序、将列表加入歌单、最近播放与清空。
4. `pnpm dist` 安装后启动，确认音频与文件路径在打包环境下正常（`file://` 与封面路径）。

（本机若未跑双端，请在目标平台按上述步骤补测。）

## 项目结构（核心）

```
src/main/          # Electron 主进程：窗口、托盘、IPC、扫描、持久化
src/preload/       # 预加载：contextBridge 暴露安全 API（通道名见 shared/ipc-channels）
src/renderer/      # Vue 界面与播放逻辑
src/renderer/src/api/   # 渲染层统一入口（类比 Web 项目的 api/requests，勿散落 window.electronAPI）
src/shared/        # 共享类型与 IPC 通道常量
```

## 许可证

MIT
# mg-music
