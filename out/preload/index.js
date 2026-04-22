"use strict";
const electron = require("electron");
const IPC = {
  /** ipcMain.handle / ipcRenderer.invoke */
  invoke: {
    appGetVersion: "app:get-version",
    themeGetNative: "theme:get-native",
    persistLoad: "persist:load",
    persistSave: "persist:save",
    persistReplace: "persist:replace",
    dialogSelectMusicFolder: "dialog:select-music-folder",
    libraryImportFolder: "library:import-folder",
    libraryRescanRoot: "library:rescan-root",
    lrcReadForTrack: "lrc:read-for-track",
    audioFileUrl: "audio:file-url",
    coverResolveUrl: "cover:resolve-url",
    appCheckUpdate: "app:check-update"
  },
  /** webContents.send / ipcRenderer.on */
  event: {
    themeNativeChanged: "theme:native-changed",
    libraryScanProgress: "library:scan-progress",
    playerCommand: "player:command"
  },
  /** ipcMain.on / ipcRenderer.send（无返回） */
  mainOn: {
    shortcutsReload: "shortcuts:reload"
  }
};
const api = {
  getVersion: () => electron.ipcRenderer.invoke(IPC.invoke.appGetVersion),
  getNativeTheme: () => electron.ipcRenderer.invoke(IPC.invoke.themeGetNative),
  onNativeThemeChanged: (cb) => {
    const handler = (_, p) => cb(p);
    electron.ipcRenderer.on(IPC.event.themeNativeChanged, handler);
    return () => electron.ipcRenderer.removeListener(IPC.event.themeNativeChanged, handler);
  },
  loadPersisted: () => electron.ipcRenderer.invoke(IPC.invoke.persistLoad),
  savePartial: (partial) => electron.ipcRenderer.invoke(IPC.invoke.persistSave, partial),
  replacePersisted: (state) => electron.ipcRenderer.invoke(IPC.invoke.persistReplace, state),
  selectMusicFolder: () => electron.ipcRenderer.invoke(IPC.invoke.dialogSelectMusicFolder),
  importMusicFolder: (root) => electron.ipcRenderer.invoke(IPC.invoke.libraryImportFolder, root),
  rescanRoot: (root) => electron.ipcRenderer.invoke(IPC.invoke.libraryRescanRoot, root),
  onScanProgress: (cb) => {
    const handler = (_, p) => cb(p);
    electron.ipcRenderer.on(IPC.event.libraryScanProgress, handler);
    return () => electron.ipcRenderer.removeListener(IPC.event.libraryScanProgress, handler);
  },
  readLrcForTrack: (audioPath) => electron.ipcRenderer.invoke(IPC.invoke.lrcReadForTrack, audioPath),
  fileUrlForPath: (p) => electron.ipcRenderer.invoke(IPC.invoke.audioFileUrl, p),
  coverUrl: (coverFile) => electron.ipcRenderer.invoke(IPC.invoke.coverResolveUrl, coverFile),
  checkUpdate: () => electron.ipcRenderer.invoke(IPC.invoke.appCheckUpdate),
  reloadShortcuts: () => {
    electron.ipcRenderer.send(IPC.mainOn.shortcutsReload);
  },
  onPlayerCommand: (cb) => {
    const handler = (_, action) => cb(action);
    electron.ipcRenderer.on(IPC.event.playerCommand, handler);
    return () => electron.ipcRenderer.removeListener(IPC.event.playerCommand, handler);
  }
};
electron.contextBridge.exposeInMainWorld("electronAPI", api);
