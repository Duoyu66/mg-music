/**
 * 主进程 / preload / 渲染进程共用的 IPC 通道名（避免手写字符串不一致）
 * 参考 Web 项目中对接后端的「接口路径常量」写法
 */
export const IPC = {
  /** ipcMain.handle / ipcRenderer.invoke */
  invoke: {
    appGetVersion: 'app:get-version',
    themeGetNative: 'theme:get-native',
    persistLoad: 'persist:load',
    persistSave: 'persist:save',
    persistReplace: 'persist:replace',
    dialogSelectMusicFolder: 'dialog:select-music-folder',
    libraryImportFolder: 'library:import-folder',
    libraryRescanRoot: 'library:rescan-root',
    lrcReadForTrack: 'lrc:read-for-track',
    audioFileUrl: 'audio:file-url',
    coverResolveUrl: 'cover:resolve-url',
    trackReparse: 'track:reparse',
    shellOpenExternal: 'shell:open-external',
    appCheckUpdate: 'app:check-update'
  },
  /** webContents.send / ipcRenderer.on */
  event: {
    themeNativeChanged: 'theme:native-changed',
    libraryScanProgress: 'library:scan-progress',
    playerCommand: 'player:command'
  },
  /** ipcMain.on / ipcRenderer.send（无返回） */
  mainOn: {
    shortcutsReload: 'shortcuts:reload'
  }
} as const
