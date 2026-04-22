/** 跨主进程 / 渲染进程共享的数据结构 */

export type LoopMode = 'off' | 'list' | 'single' | 'shuffle'

export interface Track {
  id: string
  path: string
  title: string
  artist: string
  album: string
  durationSec: number
  /** 用于「按文件夹」视图：根导入目录下的相对路径分组键 */
  folderKey: string
  /** userData/covers 下的文件名，可为空 */
  coverFile?: string
}

export interface Playlist {
  id: string
  name: string
  trackIds: string[]
  createdAt: number
  updatedAt: number
}

export interface HistoryEntry {
  trackId: string
  playedAt: number
}

export interface AppSettings {
  /** 默认播放模式 */
  defaultLoopMode: LoopMode
  /** 音量 0–1 */
  volume: number
  /** 静音 */
  muted: boolean
  /** 歌词字号 px */
  lyricFontSize: number
  /** 歌词颜色（浅色主题） */
  lyricColorLight: string
  /** 歌词颜色（深色主题） */
  lyricColorDark: string
  /** 关闭主窗口时最小化到托盘（Windows 更常用） */
  minimizeToTrayOnClose: boolean
  /** 启用全局媒体快捷键（Ctrl+方向键等） */
  globalShortcutsEnabled: boolean
  /** 主题：system | light | dark */
  theme: 'system' | 'light' | 'dark'
}

export interface ScanProgress {
  current: number
  total: number
  phase: 'listing' | 'metadata'
  currentFile?: string
}

export interface PersistedState {
  folderRoots: string[]
  tracks: Track[]
  playlists: Playlist[]
  history: HistoryEntry[]
  /** 本地「我喜欢」曲目 id */
  likedTrackIds: string[]
  settings: AppSettings
}
