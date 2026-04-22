import Store from 'electron-store'
import type { AppSettings, HistoryEntry, PersistedState, Playlist, Track } from '../shared/types'

const defaults: PersistedState = {
  folderRoots: [],
  tracks: [],
  playlists: [],
  history: [],
  likedTrackIds: [],
  settings: {
    defaultLoopMode: 'list',
    volume: 0.85,
    muted: false,
    lyricFontSize: 16,
    lyricColorLight: '#4a6355',
    lyricColorDark: '#e5eaf3',
    minimizeToTrayOnClose: true,
    globalShortcutsEnabled: true,
    theme: 'light'
  }
}

/** 持久化用户曲库、歌单、历史与设置（electron-store JSON） */
export const dataStore = new Store<PersistedState>({
  name: 'mugua-music',
  defaults
})

export function getPersisted(): PersistedState {
  const settings: AppSettings = { ...defaults.settings, ...dataStore.get('settings') }
  return {
    folderRoots: dataStore.get('folderRoots'),
    tracks: dataStore.get('tracks'),
    playlists: dataStore.get('playlists'),
    history: dataStore.get('history'),
    likedTrackIds: dataStore.get('likedTrackIds', defaults.likedTrackIds),
    settings
  }
}

export function setFolderRoots(roots: string[]) {
  dataStore.set('folderRoots', roots)
}

export function setTracks(tracks: Track[]) {
  dataStore.set('tracks', tracks)
}

export function setPlaylists(playlists: Playlist[]) {
  dataStore.set('playlists', playlists)
}

export function setHistory(history: HistoryEntry[]) {
  dataStore.set('history', history)
}

export function setLikedTrackIds(ids: string[]) {
  dataStore.set('likedTrackIds', ids)
}

export function setSettings(patch: Partial<AppSettings>) {
  const cur: AppSettings = { ...defaults.settings, ...dataStore.get('settings') }
  dataStore.set('settings', { ...cur, ...patch })
}

export function replaceAll(state: PersistedState) {
  dataStore.set('folderRoots', state.folderRoots)
  dataStore.set('tracks', state.tracks)
  dataStore.set('playlists', state.playlists)
  dataStore.set('history', state.history)
  dataStore.set('likedTrackIds', state.likedTrackIds)
  dataStore.set('settings', state.settings)
}
