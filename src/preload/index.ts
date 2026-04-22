import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc-channels'
import type { PersistedState } from '../shared/types'

const api = {
  getVersion: () => ipcRenderer.invoke(IPC.invoke.appGetVersion) as Promise<string>,
  getNativeTheme: () =>
    ipcRenderer.invoke(IPC.invoke.themeGetNative) as Promise<{ shouldUseDarkColors: boolean }>,
  onNativeThemeChanged: (cb: (p: { shouldUseDarkColors: boolean }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, p: { shouldUseDarkColors: boolean }) => cb(p)
    ipcRenderer.on(IPC.event.themeNativeChanged, handler)
    return () => ipcRenderer.removeListener(IPC.event.themeNativeChanged, handler)
  },

  loadPersisted: () => ipcRenderer.invoke(IPC.invoke.persistLoad) as Promise<PersistedState>,
  savePartial: (partial: Partial<PersistedState>) => ipcRenderer.invoke(IPC.invoke.persistSave, partial),
  replacePersisted: (state: PersistedState) => ipcRenderer.invoke(IPC.invoke.persistReplace, state),

  selectMusicFolder: () =>
    ipcRenderer.invoke(IPC.invoke.dialogSelectMusicFolder) as Promise<string | null>,
  importMusicFolder: (root: string) =>
    ipcRenderer.invoke(IPC.invoke.libraryImportFolder, root) as Promise<
      | { ok: true; added: number; errors: string[] }
      | { ok: false; error: string }
    >,
  rescanRoot: (root: string) =>
    ipcRenderer.invoke(IPC.invoke.libraryRescanRoot, root) as Promise<
      | { ok: true; added: number; errors: string[] }
      | { ok: false; error: string }
    >,

  onScanProgress: (cb: (p: import('../shared/types').ScanProgress) => void) => {
    const handler = (_: Electron.IpcRendererEvent, p: import('../shared/types').ScanProgress) => cb(p)
    ipcRenderer.on(IPC.event.libraryScanProgress, handler)
    return () => ipcRenderer.removeListener(IPC.event.libraryScanProgress, handler)
  },

  readLrcForTrack: (audioPath: string) =>
    ipcRenderer.invoke(IPC.invoke.lrcReadForTrack, audioPath) as Promise<string | null>,
  fileUrlForPath: (p: string) => ipcRenderer.invoke(IPC.invoke.audioFileUrl, p) as Promise<string>,
  coverUrl: (coverFile?: string) =>
    ipcRenderer.invoke(IPC.invoke.coverResolveUrl, coverFile) as Promise<string>,

  checkUpdate: () =>
    ipcRenderer.invoke(IPC.invoke.appCheckUpdate) as Promise<
      | { status: 'available'; current: string; latest: string }
      | { status: 'none'; current: string }
      | { status: 'error'; message: string }
    >,

  reloadShortcuts: () => {
    ipcRenderer.send(IPC.mainOn.shortcutsReload)
  },

  onPlayerCommand: (cb: (action: 'toggle' | 'next' | 'prev' | 'volUp' | 'volDown') => void) => {
    const handler = (
      _: Electron.IpcRendererEvent,
      action: 'toggle' | 'next' | 'prev' | 'volUp' | 'volDown'
    ) => cb(action)
    ipcRenderer.on(IPC.event.playerCommand, handler)
    return () => ipcRenderer.removeListener(IPC.event.playerCommand, handler)
  }
}

export type ElectronAPI = typeof api

contextBridge.exposeInMainWorld('electronAPI', api)
