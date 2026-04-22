import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  BrowserWindow,
  app,
  dialog,
  globalShortcut,
  ipcMain,
  nativeTheme,
  session,
  shell
} from 'electron'
/** electron-updater 为 CJS，主进程打成 ESM 时需默认导入再取 autoUpdater */
import electronUpdater from 'electron-updater'
const { autoUpdater } = electronUpdater
import { IPC } from '../shared/ipc-channels'
import type { PersistedState } from '../shared/types'
import { parseAudioFile, scanMusicFolder, tryReadLrcForTrack } from './library'
import { buildAppMenu } from './menu'
import {
  dataStore,
  getPersisted,
  replaceAll,
  setFolderRoots,
  setHistory,
  setLikedTrackIds,
  setPlaylists,
  setSettings,
  setTracks
} from './persist'
import { createTray, destroyTray } from './tray'

/** 须在 ready 之前调用，才与菜单/关于 等表现一致；开发态 Dock 名称另依赖 scripts/ensure-macos-electron-rebrand.mjs */
app.setName('木瓜音乐')

/** 退出时不再拦截关闭到托盘 */
let isQuitting = false

let mainWindow: BrowserWindow | null = null

/** setupIpc 里注册，will-quit 时移除，避免进程退出后仍挂监听 */
let nativeThemeUpdatedHandler: (() => void) | null = null

function broadcast(channel: string, ...args: unknown[]) {
  mainWindow?.webContents.send(channel, ...args)
}

function sendPlayback(action: 'toggle' | 'next' | 'prev' | 'volUp' | 'volDown') {
  broadcast(IPC.event.playerCommand, action)
}

/**
 * 渲染进程 axios 访问「与页面不同源」的 https 接口时，若服务端未返回 CORS 头，浏览器会拦截。
 * 在开发（localhost:9000 → 线上域名）与打包后（file:// → 线上）均可能发生。
 * 此处仅对 XHR/fetch 响应补全缺失的 Access-Control-*（优先仍应在网关/Spring 配置 CORS）。
 */
function installRendererApiCorsPatch() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const rt = details.resourceType
    if (rt !== 'xhr' && rt !== 'fetch') {
      callback({ responseHeaders: details.responseHeaders })
      return
    }
    const raw = details.responseHeaders
    if (!raw) {
      callback({})
      return
    }
    const out: Record<string, string[]> = {}
    for (const [k, v] of Object.entries(raw)) {
      out[k] = Array.isArray(v) ? v : [String(v)]
    }
    const lowerKeys = new Set(Object.keys(out).map((k) => k.toLowerCase()))
    if (!lowerKeys.has('access-control-allow-origin')) {
      out['Access-Control-Allow-Origin'] = ['*']
    }
    if (!lowerKeys.has('access-control-allow-methods')) {
      out['Access-Control-Allow-Methods'] = ['GET, POST, PUT, PATCH, DELETE, OPTIONS']
    }
    if (!lowerKeys.has('access-control-allow-headers')) {
      out['Access-Control-Allow-Headers'] = [
        'Content-Type',
        'Authorization',
        'Accept',
        'X-Requested-With'
      ]
    }
    callback({ responseHeaders: out })
  })
}

function registerGlobalShortcuts() {
  globalShortcut.unregisterAll()
  const s = dataStore.get('settings')
  if (!s.globalShortcutsEnabled) return
  const ok1 = globalShortcut.register('CommandOrControl+Left', () => sendPlayback('prev'))
  const ok2 = globalShortcut.register('CommandOrControl+Right', () => sendPlayback('next'))
  const ok3 = globalShortcut.register('CommandOrControl+Up', () => sendPlayback('volUp'))
  const ok4 = globalShortcut.register('CommandOrControl+Down', () => sendPlayback('volDown'))
  if (!ok1 || !ok2 || !ok3 || !ok4) {
    console.warn('[木瓜音乐] 部分全局快捷键注册失败（可能被系统占用）')
  }
}

function createWindow() {
  const preloadBase = join(__dirname, '../preload')
  const preloadFile = existsSync(join(preloadBase, 'index.js')) ? 'index.js' : 'index.mjs'
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 760,
    minWidth: 800,
    minHeight: 560,
    show: false,
    title: '木瓜音乐',
    webPreferences: {
      preload: join(preloadBase, preloadFile),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.on('close', (e) => {
    const minimize = dataStore.get('settings').minimizeToTrayOnClose
    if (!isQuitting && minimize) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })

  buildAppMenu(mainWindow, {
    toggle: () => sendPlayback('toggle'),
    next: () => sendPlayback('next'),
    prev: () => sendPlayback('prev')
  })

  createTray(mainWindow, {
    togglePlay: () => sendPlayback('toggle'),
    quit: () => {
      isQuitting = true
      app.quit()
    }
  })
}

function setupIpc() {
  ipcMain.handle(IPC.invoke.appGetVersion, () => app.getVersion())

  ipcMain.handle(IPC.invoke.themeGetNative, () => ({
    shouldUseDarkColors: nativeTheme.shouldUseDarkColors
  }))

  nativeThemeUpdatedHandler = () => {
    broadcast(IPC.event.themeNativeChanged, { shouldUseDarkColors: nativeTheme.shouldUseDarkColors })
  }
  nativeTheme.on('updated', nativeThemeUpdatedHandler)

  ipcMain.handle(IPC.invoke.persistLoad, (): PersistedState => getPersisted())

  ipcMain.handle(IPC.invoke.persistSave, (_e, partial: Partial<PersistedState>) => {
    if (partial.folderRoots) setFolderRoots(partial.folderRoots)
    if (partial.tracks) setTracks(partial.tracks)
    if (partial.playlists) setPlaylists(partial.playlists)
    if (partial.history) setHistory(partial.history)
    if (partial.likedTrackIds !== undefined) setLikedTrackIds(partial.likedTrackIds)
    if (partial.settings) setSettings(partial.settings)
  })

  ipcMain.handle(IPC.invoke.persistReplace, (_e, state: PersistedState) => {
    replaceAll(state)
  })

  ipcMain.handle(IPC.invoke.dialogSelectMusicFolder, async () => {
    if (!mainWindow) return null
    const r = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory']
    })
    if (r.canceled || !r.filePaths[0]) return null
    return r.filePaths[0]
  })

  ipcMain.handle(IPC.invoke.libraryImportFolder, async (_e, rootFolder: string) => {
    if (!mainWindow) return { ok: false as const, error: '窗口未就绪' }
    const persisted = getPersisted()
    const existing = new Set(persisted.tracks.map((t) => t.path))
    const roots = new Set(persisted.folderRoots)
    roots.add(rootFolder)
    setFolderRoots([...roots])

    const { tracks: newTracks, errors } = await scanMusicFolder(rootFolder, mainWindow, existing)
    const byPath = new Map(persisted.tracks.map((t) => [t.path, t] as const))
    for (const t of newTracks) {
      byPath.set(t.path, t)
    }
    setTracks([...byPath.values()])
    return { ok: true as const, added: newTracks.length, errors }
  })

  /** 重新扫描某个根目录下尚未入库的文件（不重复解析已存在路径） */
  ipcMain.handle(IPC.invoke.libraryRescanRoot, async (_e, rootFolder: string) => {
    if (!mainWindow) return { ok: false as const, error: '窗口未就绪' }
    const persisted = getPersisted()
    const existing = new Set(persisted.tracks.map((t) => t.path))
    const { tracks: newTracks, errors } = await scanMusicFolder(rootFolder, mainWindow, existing)
    const byPath = new Map(persisted.tracks.map((t) => [t.path, t] as const))
    for (const t of newTracks) byPath.set(t.path, t)
    setTracks([...byPath.values()])
    return { ok: true as const, added: newTracks.length, errors }
  })

  ipcMain.handle(IPC.invoke.lrcReadForTrack, async (_e, audioPath: string) => {
    const text = await tryReadLrcForTrack(audioPath)
    return text
  })

  ipcMain.handle(IPC.invoke.audioFileUrl, (_e, filePath: string) => {
    try {
      return pathToFileURL(filePath).href
    } catch {
      return ''
    }
  })

  ipcMain.handle(IPC.invoke.coverResolveUrl, (_e, coverFile?: string) => {
    if (!coverFile) return ''
    const full = join(app.getPath('userData'), 'covers', coverFile)
    try {
      return pathToFileURL(full).href
    } catch {
      return ''
    }
  })

  ipcMain.handle(IPC.invoke.trackReparse, async (_e, trackPath: string, rootHint: string) => {
    const roots = getPersisted().folderRoots
    const root = roots.find((r) => trackPath.startsWith(r)) ?? rootHint
    const { track, error } = await parseAudioFile(trackPath, root)
    return { track, error }
  })

  ipcMain.handle(IPC.invoke.shellOpenExternal, async (_e, url: string) => {
    await shell.openExternal(url)
  })

  ipcMain.handle(IPC.invoke.appCheckUpdate, async () => {
    try {
      autoUpdater.autoDownload = false
      const result = await autoUpdater.checkForUpdates()
      const remote = result?.updateInfo?.version
      const cur = app.getVersion()
      if (remote && remote !== cur) {
        return { status: 'available' as const, current: cur, latest: remote }
      }
      return { status: 'none' as const, current: cur }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { status: 'error' as const, message: msg }
    }
  })
}

app.whenReady().then(() => {
  installRendererApiCorsPatch()
  setupIpc()
  createWindow()
  registerGlobalShortcuts()

  ipcMain.on(IPC.mainOn.shortcutsReload, () => {
    registerGlobalShortcuts()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    else mainWindow?.show()
  })

  /**
   * Windows / Linux：最后一个窗口关闭即退出进程。
   * macOS：按系统惯例关闭全部窗口后进程仍可留在 Dock，需用户 Cmd+Q 或托盘「退出」才真正结束（故此处不 quit）。
   */
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  app.on('will-quit', () => {
    if (nativeThemeUpdatedHandler) {
      nativeTheme.removeListener('updated', nativeThemeUpdatedHandler)
      nativeThemeUpdatedHandler = null
    }
    session.defaultSession.webRequest.onHeadersReceived(null)
    ipcMain.removeAllListeners(IPC.mainOn.shortcutsReload)
    globalShortcut.unregisterAll()
    destroyTray()
  })

  app.on('before-quit', () => {
    isQuitting = true
  })
})
