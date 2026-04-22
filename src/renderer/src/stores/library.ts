import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { electronLibrary, electronPersist } from '@renderer/api/electron'
import type { HistoryEntry, PersistedState, Playlist, ScanProgress, Track } from '@shared/types'

function uid() {
  return crypto.randomUUID()
}

export type BrowseMode =
  | { kind: 'all' }
  | { kind: 'artist'; key: string }
  | { kind: 'album'; key: string }
  | { kind: 'folder'; key: string }
  | { kind: 'playlist'; id: string }
  | { kind: 'history' }
  | { kind: 'liked' }

export const useLibraryStore = defineStore('library', () => {
  const tracks = ref<Track[]>([])
  const playlists = ref<Playlist[]>([])
  const history = ref<HistoryEntry[]>([])
  const folderRoots = ref<string[]>([])
  const settings = ref<PersistedState['settings'] | null>(null)
  const likedTrackIds = ref<string[]>([])

  const browse = ref<BrowseMode>({ kind: 'all' })
  const searchText = ref('')

  const trackMap = computed(() => {
    const m = new Map<string, Track>()
    for (const t of tracks.value) m.set(t.id, t)
    return m
  })

  const filteredTracks = computed(() => {
    const q = searchText.value.trim().toLowerCase()
    const b = browse.value
    let list = tracks.value
    if (b.kind === 'artist') {
      list = list.filter((t) => t.artist === b.key)
    } else if (b.kind === 'album') {
      list = list.filter((t) => `${t.artist} — ${t.album}` === b.key)
    } else if (b.kind === 'folder') {
      list = list.filter((t) => t.folderKey === b.key)
    } else if (b.kind === 'playlist') {
      const pl = playlists.value.find((p) => p.id === b.id)
      const ids = pl?.trackIds ?? []
      list = ids.map((id) => trackMap.value.get(id)).filter((t): t is Track => !!t)
    } else if (b.kind === 'history') {
      const ids = history.value.map((h) => h.trackId)
      const seen = new Set<string>()
      list = []
      for (const id of ids) {
        if (seen.has(id)) continue
        seen.add(id)
        const tr = trackMap.value.get(id)
        if (tr) list.push(tr)
      }
    } else if (b.kind === 'liked') {
      const set = new Set(likedTrackIds.value)
      list = tracks.value.filter((t) => set.has(t.id))
    }
    if (!q) return list
    return list.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q) ||
        t.album.toLowerCase().includes(q)
    )
  })

  const artists = computed(() => {
    const s = new Set<string>()
    for (const t of tracks.value) s.add(t.artist)
    return [...s].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  })

  const albums = computed(() => {
    const s = new Set<string>()
    for (const t of tracks.value) s.add(`${t.artist} — ${t.album}`)
    return [...s].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  })

  const folders = computed(() => {
    const s = new Set<string>()
    for (const t of tracks.value) s.add(t.folderKey)
    return [...s].sort((a, b) => a.localeCompare(b, 'zh-CN'))
  })

  async function hydrate() {
    const data = await electronPersist.load()
    tracks.value = data.tracks
    playlists.value = data.playlists
    history.value = data.history
    folderRoots.value = data.folderRoots
    settings.value = data.settings
    likedTrackIds.value = data.likedTrackIds ?? []
  }

  async function persistCore() {
    if (!settings.value) return
    await electronPersist.savePartial({
      tracks: tracks.value,
      playlists: playlists.value,
      history: history.value,
      folderRoots: folderRoots.value,
      likedTrackIds: likedTrackIds.value,
      settings: settings.value
    })
  }

  function isLiked(trackId: string) {
    return likedTrackIds.value.includes(trackId)
  }

  function toggleLike(trackId: string) {
    const i = likedTrackIds.value.indexOf(trackId)
    if (i >= 0) {
      likedTrackIds.value = likedTrackIds.value.filter((id) => id !== trackId)
    } else {
      likedTrackIds.value = [...likedTrackIds.value, trackId]
    }
    void persistCore()
  }

  async function updateSettings(patch: Partial<PersistedState['settings']>) {
    if (!settings.value) return
    settings.value = { ...settings.value, ...patch }
    await persistCore()
    if ('globalShortcutsEnabled' in patch) {
      electronPersist.reloadShortcuts()
    }
  }

  async function importFolder(onProgress?: (p: ScanProgress) => void) {
    const root = await electronLibrary.selectMusicFolder()
    if (!root) return
    const unsub = onProgress ? electronLibrary.onScanProgress(onProgress) : () => {}
    let result: Awaited<ReturnType<typeof electronLibrary.importMusicFolder>>
    try {
      result = await electronLibrary.importMusicFolder(root)
    } finally {
      unsub()
    }
    if (!result.ok) {
      ElMessage.error(result.error)
      return
    }
    await hydrate()
    if (result.errors.length) {
      ElMessage.warning(`导入完成，${result.added} 首；部分文件解析失败（${result.errors.length}）`)
    } else {
      ElMessage.success(`成功导入 ${result.added} 首歌曲`)
    }
  }

  function createPlaylist(name: string) {
    const now = Date.now()
    const pl: Playlist = {
      id: uid(),
      name,
      trackIds: [],
      createdAt: now,
      updatedAt: now
    }
    playlists.value = [pl, ...playlists.value]
    void persistCore()
    return pl
  }

  function renamePlaylist(id: string, name: string) {
    playlists.value = playlists.value.map((p) =>
      p.id === id ? { ...p, name, updatedAt: Date.now() } : p
    )
    void persistCore()
  }

  function removePlaylist(id: string) {
    playlists.value = playlists.value.filter((p) => p.id !== id)
    if (browse.value.kind === 'playlist' && browse.value.id === id) {
      browse.value = { kind: 'all' }
    }
    void persistCore()
  }

  function reorderPlaylist(id: string, orderedIds: string[]) {
    playlists.value = playlists.value.map((p) =>
      p.id === id ? { ...p, trackIds: orderedIds, updatedAt: Date.now() } : p
    )
    void persistCore()
  }

  function addTracksToPlaylist(plId: string, ids: string[]) {
    playlists.value = playlists.value.map((p) => {
      if (p.id !== plId) return p
      const set = new Set(p.trackIds)
      for (const id of ids) set.add(id)
      return { ...p, trackIds: [...set], updatedAt: Date.now() }
    })
    void persistCore()
  }

  function pushHistory(trackId: string) {
    const entry: HistoryEntry = { trackId, playedAt: Date.now() }
    history.value = [entry, ...history.value.filter((h) => h.trackId !== trackId)].slice(0, 200)
    void persistCore()
  }

  function clearHistory() {
    history.value = []
    void persistCore()
  }

  /** 将当前浏览列表作为播放队列来源 */
  function getQueueFromBrowse(): string[] {
    return filteredTracks.value.map((t) => t.id)
  }

  return {
    tracks,
    playlists,
    history,
    folderRoots,
    settings,
    likedTrackIds,
    browse,
    searchText,
    trackMap,
    filteredTracks,
    artists,
    albums,
    folders,
    hydrate,
    persistCore,
    updateSettings,
    importFolder,
    createPlaylist,
    renamePlaylist,
    removePlaylist,
    reorderPlaylist,
    addTracksToPlaylist,
    pushHistory,
    clearHistory,
    getQueueFromBrowse,
    isLiked,
    toggleLike
  }
})
