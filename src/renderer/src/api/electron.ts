import type { ElectronAPI } from '../../../preload/index'

/**
 * 获取预加载脚本暴露的 API（与 H5 里集中封装 `requests` 类似：
 * 业务只通过本模块访问主进程，便于 mock / 扩展）
 */
export function getElectronApi(): ElectronAPI {
  const api = window.electronAPI
  if (!api) {
    throw new Error('[木瓜音乐] 仅能在 Electron 渲染进程中访问主进程能力')
  }
  return api
}

/** 应用、主题、更新、全局快捷键回调 */
export const electronApp = {
  getVersion: () => getElectronApi().getVersion(),
  getNativeTheme: () => getElectronApi().getNativeTheme(),
  onNativeThemeChanged: (cb: (p: { shouldUseDarkColors: boolean }) => void) =>
    getElectronApi().onNativeThemeChanged(cb),
  checkUpdate: () => getElectronApi().checkUpdate(),
  onPlayerCommand: (
    cb: (action: 'toggle' | 'next' | 'prev' | 'volUp' | 'volDown') => void
  ) => getElectronApi().onPlayerCommand(cb)
}

/** 持久化与快捷键重载 */
export const electronPersist = {
  load: () => getElectronApi().loadPersisted(),
  savePartial: (partial: Parameters<ElectronAPI['savePartial']>[0]) =>
    getElectronApi().savePartial(partial),
  replace: (state: Parameters<ElectronAPI['replacePersisted']>[0]) =>
    getElectronApi().replacePersisted(state),
  reloadShortcuts: () => getElectronApi().reloadShortcuts()
}

/** 曲库扫描、目录选择 */
export const electronLibrary = {
  selectMusicFolder: () => getElectronApi().selectMusicFolder(),
  importMusicFolder: (root: string) => getElectronApi().importMusicFolder(root),
  rescanRoot: (root: string) => getElectronApi().rescanRoot(root),
  onScanProgress: (cb: Parameters<ElectronAPI['onScanProgress']>[0]) =>
    getElectronApi().onScanProgress(cb)
}

/** 媒体路径、封面、歌词 */
export const electronMedia = {
  readLrcForTrack: (audioPath: string) => getElectronApi().readLrcForTrack(audioPath),
  fileUrlForPath: (p: string) => getElectronApi().fileUrlForPath(p),
  coverUrl: (coverFile?: string) => getElectronApi().coverUrl(coverFile)
}
