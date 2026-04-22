<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch
} from 'vue'
import {
  ArrowLeft,
  ArrowRight,
  ChatLineRound,
  Clock,
  Close,
  Collection,
  FolderOpened,
  Headset,
  HomeFilled,
  Loading,
  Mute,
  Plus,
  Setting,
  Star,
  StarFilled,
  VideoPause,
  VideoPlay,
  RefreshRight,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import Sortable from 'sortablejs'
import type { Track } from '@shared/types'
import { electronApp, electronMedia } from '@renderer/api/electron'
import { reqFavoriteList, reqGetMusicHomeInfo } from '@renderer/api/music'
import { FIXED_USER_ID } from '@renderer/constants/user'
import { resolveQueueForPlayback } from '@renderer/utils/resolveRemotePlayback'
import type { RemoteSong } from '@renderer/types/remote-song'
import { activeLrcIndex, parseLrc, type LrcLine } from './utils/lrc'
import { useLibraryStore } from './stores/library'
import { usePlayerStore } from './stores/player'
import OnlineMusicPanel from './components/OnlineMusicPanel.vue'

const lib = useLibraryStore()
/** 侧栏：home | lib(乐库) | local | liked | history | pl:歌单id */
const sideNav = ref('home')
const lyricsOpen = ref(true)
const tableHeight = 'calc(100vh - 400px)'
const player = usePlayerStore()

const isListView = computed(
  () =>
    sideNav.value !== 'home' && sideNav.value !== 'lib'
)
const isPlaylistView = computed(
  () => sideNav.value.startsWith('pl:') && lib.browse.kind === 'playlist'
)
const currentPlaylist = computed(() => {
  const b = lib.browse
  if (b.kind !== 'playlist') return null
  return lib.playlists.find((p) => p.id === b.id) ?? null
})

/** 顶栏前进/后退 */
const navBack = ref<string[]>([])
const navForward = ref<string[]>([])

const likedCount = computed(() => lib.likedTrackIds.length)
const historyUniqueCount = computed(() => {
  const seen = new Set<string>()
  for (const h of lib.history) {
    if (!seen.has(h.trackId)) seen.add(h.trackId)
  }
  return seen.size
})

/** 乐馆子标签（与 QQ 主站布局一致，仅影响首页展示块） */
const homeViewTab = ref<'featured' | 'rank' | 'singer' | 'cat'>('featured')

const canTopBack = computed(() => navBack.value.length > 0)
const canTopForward = computed(() => navForward.value.length > 0)

function applyNavBrowse(n: string) {
  if (n === 'local') {
    lib.browse = { kind: 'all' }
  } else if (n === 'liked') {
    lib.browse = { kind: 'liked' }
  } else if (n === 'history') {
    lib.browse = { kind: 'history' }
  } else if (n.startsWith('pl:')) {
    const id = n.slice(3)
    lib.browse = { kind: 'playlist', id }
  } else if (n === 'home') {
    void loadLocalTabServerData()
  }
}

function goNav(n: string) {
  if (n === sideNav.value) {
    if (n === 'home') void loadLocalTabServerData()
    return
  }
  navBack.value.push(sideNav.value)
  navForward.value = []
  sideNav.value = n
  applyNavBrowse(n)
}

function topBarBack() {
  if (navBack.value.length === 0) return
  const prev = navBack.value.pop()!
  navForward.value.unshift(sideNav.value)
  sideNav.value = prev
  applyNavBrowse(prev)
}

function topBarForward() {
  if (navForward.value.length === 0) return
  const next = navForward.value.shift()!
  navBack.value.push(sideNav.value)
  sideNav.value = next
  applyNavBrowse(next)
}

function topBarRefresh() {
  if (sideNav.value === 'home') {
    void loadLocalTabServerData()
  }
}

function playlistThumbLetter(name: string) {
  const t = name.trim()
  return t.length > 0 ? t.charAt(0) : '·'
}

/**
 * 与 web_f 一致：getMusicHomeInfo → 今日推荐横条（可点播放）；
 * getFavoriteSongs → 博主推荐列表（web_f 侧栏「博主推荐」页数据源）。
 */
const serverHomeLoading = ref(false)
const serverRecommendList = ref<Record<string, unknown>[]>([])

const bloggerLoading = ref(false)
const bloggerRecommendList = ref<Record<string, unknown>[]>([])

async function loadMusicHomeStrip() {
  serverHomeLoading.value = true
  try {
    const res = (await reqGetMusicHomeInfo({ id: FIXED_USER_ID })) as {
      status?: boolean
      data?: { recommendList?: Record<string, unknown>[] }
    }
    if (res?.status && res.data?.recommendList) {
      serverRecommendList.value = res.data.recommendList
    } else {
      serverRecommendList.value = []
    }
  } catch {
    serverRecommendList.value = []
  } finally {
    serverHomeLoading.value = false
  }
}

async function loadBloggerRecommend() {
  bloggerLoading.value = true
  try {
    const res = (await reqFavoriteList({ id: FIXED_USER_ID })) as {
      status?: boolean
      data?: Record<string, unknown>[]
    }
    if (res?.status && Array.isArray(res.data)) {
      bloggerRecommendList.value = res.data
    } else {
      bloggerRecommendList.value = []
    }
  } catch {
    bloggerRecommendList.value = []
  } finally {
    bloggerLoading.value = false
  }
}

async function loadLocalTabServerData() {
  await Promise.all([loadMusicHomeStrip(), loadBloggerRecommend()])
}

const onlinePlayBusy = ref(false)

/** 与 player.setRemoteQueue 相同逻辑；直接写 store，避免个别环境下 action 未挂上导致 is not a function */
function applyRemoteQueueFromApp(songs: RemoteSong[], startIndex: number) {
  if (songs.length === 0) return
  player.playbackSource = 'remote'
  player.queueIds = []
  player.remoteQueue = songs.map((s) => ({ ...s }))
  player.remoteIndex = Math.min(Math.max(0, startIndex), songs.length - 1)
}

async function playRemoteQueue(raws: Record<string, unknown>[], startIndex: number) {
  if (!raws.length || onlinePlayBusy.value) return
  onlinePlayBusy.value = true
  try {
    const queue = await resolveQueueForPlayback(raws)
    if (!queue.length) {
      ElMessage.warning('无法解析播放地址（请检查网络或后端 playSearchSong）')
      return
    }
    let idx = Math.min(Math.max(0, startIndex), raws.length - 1)
    const wantId = raws[idx]?.id != null ? String(raws[idx]!.id) : ''
    if (wantId) {
      const hit = queue.findIndex((s) => s.id === wantId)
      if (hit >= 0) idx = hit
    } else {
      idx = 0
    }
    applyRemoteQueueFromApp(queue, idx)
    player.isPlaying = true
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '播放失败')
  } finally {
    onlinePlayBusy.value = false
  }
}

async function onStripItemClick(raw: Record<string, unknown>, index: number) {
  await playRemoteQueue(serverRecommendList.value, index)
}

function onBloggerRowDblClick(row: Record<string, unknown>) {
  const idx = bloggerRecommendList.value.indexOf(row)
  void playRemoteQueue(bloggerRecommendList.value, idx >= 0 ? idx : 0)
}

function bloggerRowClassName({ row }: { row: Record<string, unknown> }) {
  if (player.playbackSource !== 'remote') return ''
  const id = row.id != null ? String(row.id) : ''
  if (id && player.currentRemoteSong?.id === id) return 'mugua-row-playing'
  return ''
}

const audioRef = ref<HTMLAudioElement | null>(null)
const tableRef = ref()
const scanning = ref(false)
const scanLabel = ref('')
const nativeDark = ref(false)
const coverUrl = ref('')
const lrcLines = ref<LrcLine[]>([])
const lyricScrollRef = ref<HTMLElement | null>(null)

const currentLrcIndex = computed(() => activeLrcIndex(lrcLines.value, player.currentTimeSec))

const isDark = computed(() => {
  const th = lib.settings?.theme ?? 'system'
  if (th === 'dark') return true
  if (th === 'light') return false
  return nativeDark.value
})

function typingTarget(el: EventTarget | null) {
  if (!el || !(el instanceof HTMLElement)) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable
}

let offCmd: (() => void) | null = null
let offTheme: (() => void) | null = null
let sortable: Sortable | null = null

async function refreshCover(tr: Track | null) {
  if (!tr) {
    coverUrl.value = ''
    return
  }
  if (tr.coverFile) {
    coverUrl.value = await electronMedia.coverUrl(tr.coverFile)
  } else {
    coverUrl.value = ''
  }
}

function applyRemoteCoverAndLrc(rs: { cover?: string; lrc?: string } | null) {
  coverUrl.value = rs?.cover ? String(rs.cover) : ''
  lrcLines.value = []
  if (rs?.lrc) lrcLines.value = parseLrc(String(rs.lrc))
}

async function refreshLrc(tr: Track | null) {
  lrcLines.value = []
  if (!tr) return
  const text = await electronMedia.readLrcForTrack(tr.path)
  if (text) lrcLines.value = parseLrc(text)
}

watch(
  () =>
    [player.playbackSource, player.currentTrack, player.currentRemoteSong] as const,
  async ([src, tr, rs]) => {
    const a = audioRef.value
    if (src === 'remote') {
      applyRemoteCoverAndLrc(rs)
      if (!a) return
      if (!rs?.url) {
        a.removeAttribute('src')
        return
      }
      a.src = rs.url
      a.volume = player.muted ? 0 : player.volume
      if (player.isPlaying) {
        void a.play().catch((e) => ElMessage.error(`无法播放：${String(e)}`))
      }
      return
    }
    await refreshCover(tr)
    await refreshLrc(tr)
    if (!a) return
    if (!tr) {
      a.removeAttribute('src')
      return
    }
    const url = await electronMedia.fileUrlForPath(tr.path)
    a.src = url
    a.volume = player.muted ? 0 : player.volume
    if (player.isPlaying) {
      void a.play().catch((e) => ElMessage.error(`无法播放：${String(e)}`))
    }
  },
  { immediate: true }
)

watch(
  () => [currentLrcIndex.value, lrcLines.value.length] as const,
  () => {
    const idx = currentLrcIndex.value
    const el = lyricScrollRef.value?.querySelector(`[data-lrc="${idx}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }
)

watch(
  () => player.isPlaying,
  (v) => {
    const a = audioRef.value
    if (!a) return
    if (v) void a.play().catch((e) => ElMessage.error(`播放失败：${String(e)}`))
    else a.pause()
  }
)

watch(
  () => [player.volume, player.muted] as const,
  () => {
    const a = audioRef.value
    if (!a) return
    a.volume = player.muted ? 0 : player.volume
  }
)

function onAudioTime() {
  const a = audioRef.value
  if (!a) return
  player.currentTimeSec = a.currentTime || 0
  player.durationSec = a.duration && !Number.isNaN(a.duration) ? a.duration : 0
}

function onAudioEnded() {
  player.advanceEnded()
}

function onAudioPlay() {
  const tr = player.currentTrack
  if (tr && player.currentTimeSec < 1) {
    lib.pushHistory(tr.id)
  }
}

function cycleLoop() {
  const order: Array<typeof player.loopMode> = ['list', 'single', 'shuffle', 'off']
  const i = order.indexOf(player.loopMode)
  player.loopMode = order[(i + 1) % order.length]!
  void lib.updateSettings({ defaultLoopMode: player.loopMode })
}

const loopLabel = computed(() => {
  const m = player.loopMode
  if (m === 'list') return '列表循环'
  if (m === 'single') return '单曲循环'
  if (m === 'shuffle') return '随机播放'
  return '顺序播放'
})

function playFromList(tr: Track) {
  const ids = lib.filteredTracks.map((t) => t.id)
  const idx = ids.indexOf(tr.id)
  player.setQueue(ids, Math.max(0, idx))
  player.isPlaying = true
}

function onLocalRowDblClick(row: Track) {
  playFromList(row)
}

function goNext() {
  player.goNext()
}

function goPrev() {
  player.goPrev()
}

function onKeydown(e: KeyboardEvent) {
  if (e.code === 'Space' && !typingTarget(e.target)) {
    e.preventDefault()
    player.isPlaying = !player.isPlaying
  }
}

async function onImport() {
  scanning.value = true
  scanLabel.value = '正在扫描音频文件…'
  try {
    await lib.importFolder((p) => {
      scanLabel.value = `解析元数据 ${p.current}/${p.total}`
    })
  } finally {
    scanning.value = false
  }
}

async function createPlaylist() {
  const { value } = await ElMessageBox.prompt('请输入歌单名称', '新建歌单', {
    confirmButtonText: '创建',
    cancelButtonText: '取消',
    inputPattern: /.+/,
    inputErrorMessage: '名称不能为空'
  }).catch(() => ({ value: null }))
  if (!value) return
  const pl = lib.createPlaylist(value.trim())
  goNav(`pl:${pl.id}`)
  ElMessage.success('已创建歌单')
}

function setupSortable() {
  sortable?.destroy()
  sortable = null
  if (!isListView.value) return
  if (lib.browse.kind !== 'playlist') return
  nextTick(() => {
    const wrap = tableRef.value?.$el?.querySelector?.('.el-table__body-wrapper tbody') as HTMLElement | undefined
    if (!wrap) return
    sortable = Sortable.create(wrap, {
      animation: 150,
      onEnd: (evt) => {
        const plId = lib.browse.kind === 'playlist' ? lib.browse.id : ''
        const pl = lib.playlists.find((p) => p.id === plId)
        if (!pl) return
        const ids = [...pl.trackIds]
        const moved = ids.splice(evt.oldIndex ?? 0, 1)[0]
        if (!moved) return
        ids.splice(evt.newIndex ?? 0, 0, moved)
        lib.reorderPlaylist(plId, ids)
      }
    })
  })
}

watch(
  () => [lib.browse, lib.filteredTracks.length, sideNav] as const,
  () => {
    setupSortable()
  },
  { flush: 'post' }
)

onMounted(async () => {
  await lib.hydrate()
  void loadLocalTabServerData()
  player.applyFromSettings()
  const nt = await electronApp.getNativeTheme()
  nativeDark.value = nt.shouldUseDarkColors
  offTheme = electronApp.onNativeThemeChanged((p) => {
    nativeDark.value = p.shouldUseDarkColors
  })
  offCmd = electronApp.onPlayerCommand((a) => {
    if (a === 'toggle') player.isPlaying = !player.isPlaying
    if (a === 'next') goNext()
    if (a === 'prev') goPrev()
    if (a === 'volUp') {
      player.volume = Math.min(1, player.volume + 0.05)
      void lib.updateSettings({ volume: player.volume })
    }
    if (a === 'volDown') {
      player.volume = Math.max(0, player.volume - 0.05)
      void lib.updateSettings({ volume: player.volume })
    }
  })
  window.addEventListener('keydown', onKeydown)
  setupSortable()
  watch(
    isDark,
    (d) => {
      document.documentElement.classList.toggle('dark', d)
      document.documentElement.classList.toggle('mugua-ui-dark', d)
      document.documentElement.classList.toggle('mugua-ui-light', !d)
    },
    { immediate: true }
  )
})

onBeforeUnmount(() => {
  offCmd?.()
  offTheme?.()
  sortable?.destroy()
  window.removeEventListener('keydown', onKeydown)
})

const settingsVisible = ref(false)

async function onCheckUpdate() {
  const r = await electronApp.checkUpdate()
  if (r.status === 'available') {
    await ElMessageBox.alert(`发现新版本 ${r.latest}（当前 ${r.current}）`, '检查更新', {
      confirmButtonText: '知道了'
    })
  } else if (r.status === 'none') {
    ElMessage.success(`当前已是最新版本（${r.current}）`)
  } else {
    ElMessage.warning(`检查更新失败：${r.message}`)
  }
}

function formatDur(sec: number) {
  if (!sec || Number.isNaN(sec)) return '0:00'
  const s = Math.floor(sec)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

function onSeek(v: number) {
  const a = audioRef.value
  if (a) a.currentTime = v
}

function onSeekBarInput(v: number) {
  onSeek(v)
}

function onAddToPlaylist(plId: string) {
  lib.addTracksToPlaylist(plId, lib.filteredTracks.map((t) => t.id))
  ElMessage.success('已加入歌单')
}

function onFilterArtist(v: string | undefined) {
  lib.browse = v ? { kind: 'artist', key: v } : { kind: 'all' }
}
function onFilterAlbum(v: string | undefined) {
  lib.browse = v ? { kind: 'album', key: v } : { kind: 'all' }
}
function onFilterFolder(v: string | undefined) {
  lib.browse = v ? { kind: 'folder', key: v } : { kind: 'all' }
}

const lyricColor = computed(() => {
  const s = lib.settings
  if (!s) return '#303133'
  return isDark.value ? s.lyricColorDark : s.lyricColorLight
})

const lyricFontSize = computed(() => `${lib.settings?.lyricFontSize ?? 16}px`)

const browsePlaylistName = computed(() => {
  const b = lib.browse
  if (b.kind !== 'playlist') return ''
  return lib.playlists.find((p) => p.id === b.id)?.name ?? ''
})

const plHeroCoverUrl = ref('')
watch(
  () => [isPlaylistView.value, lib.filteredTracks] as const,
  async ([on, list]) => {
    plHeroCoverUrl.value = ''
    if (!on) return
    for (const t of list) {
      if (t.coverFile) {
        plHeroCoverUrl.value = await electronMedia.coverUrl(t.coverFile)
        break
      }
    }
  },
  { immediate: true, deep: true }
)

const listViewTitle = computed(() => {
  const b = lib.browse
  if (b.kind === 'all') return '本地歌曲'
  if (b.kind === 'history') return '最近播放'
  if (b.kind === 'liked') return '我喜欢'
  if (b.kind === 'artist') return `歌手 · ${b.key}`
  if (b.kind === 'album') return `专辑 · ${b.key}`
  if (b.kind === 'folder') return `文件夹 · ${b.key}`
  if (b.kind === 'playlist') return browsePlaylistName.value || '歌单'
  return '音乐'
})

function rowClassName({ row }: { row: Track }) {
  return row.id === player.currentId ? 'mugua-row-playing' : ''
}

async function renamePlaylist() {
  const b = lib.browse
  if (b.kind !== 'playlist') return
  const pl = lib.playlists.find((p) => p.id === b.id)
  if (!pl) return
  const { value } = await ElMessageBox.prompt('重命名歌单', '编辑', {
    inputValue: pl.name
  }).catch(() => ({ value: null }))
  if (!value) return
  lib.renamePlaylist(pl.id, value.trim())
}

async function deletePlaylist() {
  const b = lib.browse
  if (b.kind !== 'playlist') return
  const id = b.id
  await ElMessageBox.confirm('确定删除该歌单？（不会删除本地文件）', '确认', { type: 'warning' })
  lib.removePlaylist(id)
  if (sideNav.value === `pl:${id}`) goNav('local')
}

const showLocalFilters = computed(() => {
  if (sideNav.value !== 'local') return false
  const k = lib.browse.kind
  return k === 'all' || k === 'artist' || k === 'album' || k === 'folder'
})
</script>

<template>
  <el-config-provider :locale="zhCn">
    <div class="mugua-shell">
      <div v-if="scanning" class="mugua-loading-mask">
        <el-icon class="is-loading" :size="28"><Loading /></el-icon>
        <div class="mugua-loading-text">{{ scanLabel }}</div>
      </div>

      <div class="mugua-main">
        <aside class="mugua-sidebar mu-sidenav">
          <div class="qq-user-block" title="木瓜音乐">
            <div class="qq-user-av" aria-hidden="true">木</div>
            <div class="qq-user-meta">
              <div class="qq-user-name">木瓜用户</div>
              <div class="qq-user-badges">
                <span class="qq-user-badge">本地音乐</span>
              </div>
            </div>
          </div>
          <div class="qq-quick-grid" role="group" aria-label="快捷入口">
            <button
              type="button"
              class="qq-quick-cell"
              :class="{ 'is-active': sideNav === 'home' }"
              @click="goNav('home')"
            >
              <el-icon class="qq-quick-ic"><HomeFilled /></el-icon>
              <span>首页</span>
            </button>
            <button
              type="button"
              class="qq-quick-cell"
              :class="{ 'is-active': sideNav === 'lib' }"
              @click="goNav('lib')"
            >
              <el-icon class="qq-quick-ic"><Collection /></el-icon>
              <span>乐库</span>
            </button>
            <button
              type="button"
              class="qq-quick-cell"
              :class="{ 'is-active': sideNav === 'local' }"
              @click="goNav('local')"
            >
              <el-icon class="qq-quick-ic"><FolderOpened /></el-icon>
              <span>本地</span>
            </button>
            <button
              type="button"
              class="qq-quick-cell"
              :class="{ 'is-active': sideNav === 'history' }"
              @click="goNav('history')"
            >
              <el-icon class="qq-quick-ic"><Clock /></el-icon>
              <span>最近</span>
            </button>
          </div>
          <nav class="qq-nav" aria-label="我的音乐">
            <button
              type="button"
              class="qq-nav-item qq-nav-item--row"
              :class="{ 'is-active': sideNav === 'liked' }"
              @click="goNav('liked')"
            >
              <el-icon class="qq-nav-ic"><Star /></el-icon>
              <span class="qq-nav-label">我喜欢</span>
              <span class="qq-nav-cnt">{{ likedCount }}</span>
            </button>
            <button
              type="button"
              class="qq-nav-item qq-nav-item--row"
              :class="{ 'is-active': sideNav === 'history' }"
              @click="goNav('history')"
            >
              <el-icon class="qq-nav-ic"><Clock /></el-icon>
              <span class="qq-nav-label">最近</span>
              <span class="qq-nav-cnt">{{ historyUniqueCount }}</span>
            </button>
            <div class="mu-nav-sep mu-nav-sep--pl">
              <span>自建歌单</span>
              <button type="button" class="mu-nav-sep-add" title="新建歌单" @click="createPlaylist">
                <el-icon :size="16"><Plus /></el-icon>
              </button>
            </div>
            <div class="mu-nav-pls">
              <button
                v-for="pl in lib.playlists"
                :key="pl.id"
                type="button"
                class="qq-nav-item mu-nav-pl"
                :class="{ 'is-active': sideNav === `pl:${pl.id}` }"
                @click="goNav(`pl:${pl.id}`)"
              >
                <span class="mu-nav-pl-thumb" aria-hidden="true">{{
                  playlistThumbLetter(pl.name)
                }}</span>
                <span class="mu-nav-pl-t">{{ pl.name }}</span>
              </button>
            </div>
          </nav>
          <div class="qq-side-foot">
            <button
              type="button"
              class="qq-nav-item qq-nav-item--ghost"
              @click="settingsVisible = true"
            >
              <el-icon class="qq-nav-ic"><Setting /></el-icon>
              <span>设置</span>
            </button>
          </div>
        </aside>

        <div class="mu-work-col">
          <header class="mu-topbar">
            <div class="mu-topbar-left">
              <el-button
                :disabled="!canTopBack"
                circle
                :icon="ArrowLeft"
                @click="topBarBack"
              />
              <el-button
                :disabled="!canTopForward"
                circle
                :icon="ArrowRight"
                @click="topBarForward"
              />
              <el-button circle :icon="RefreshRight" @click="topBarRefresh" />
            </div>
            <div class="mu-topbar-center">
              <el-input
                v-model="lib.searchText"
                class="mu-search-pill"
                clearable
                placeholder="搜索音乐"
              />
            </div>
            <div class="mu-topbar-right" aria-hidden="true" />
          </header>

          <div class="mu-work-body">
            <div class="mu-work-scroll">

              <div v-show="sideNav === 'home'" class="mu-page mu-page--hall">
                <div class="mu-hall-head">
                  <h1 class="mu-hall-title">乐馆</h1>
                  <div class="mu-hall-tabs" role="tablist">
                    <button
                      type="button"
                      class="mu-hall-tab"
                      :class="{ 'is-active': homeViewTab === 'featured' }"
                      @click="homeViewTab = 'featured'"
                    >
                      精选
                    </button>
                    <button
                      type="button"
                      class="mu-hall-tab"
                      :class="{ 'is-active': homeViewTab === 'rank' }"
                      @click="homeViewTab = 'rank'"
                    >
                      排行
                    </button>
                    <button
                      type="button"
                      class="mu-hall-tab"
                      :class="{ 'is-active': homeViewTab === 'singer' }"
                      @click="homeViewTab = 'singer'"
                    >
                      歌手
                    </button>
                    <button
                      type="button"
                      class="mu-hall-tab"
                      :class="{ 'is-active': homeViewTab === 'cat' }"
                      @click="homeViewTab = 'cat'"
                    >
                      分类歌单
                    </button>
                  </div>
                </div>

                <template v-if="homeViewTab === 'featured'">
                  <div v-loading="serverHomeLoading" class="mu-card mu-card--pad">
                    <div class="mugua-strip-head">
                      <span class="mugua-strip-title">官方歌单</span>
                      <span class="mugua-strip-hint">今日推荐 · 点击即可播放</span>
                      <el-button text class="mu-link" size="small" @click="loadMusicHomeStrip">更多 ＞</el-button>
                    </div>
                    <el-scrollbar v-if="serverRecommendList.length" class="mugua-strip-scroll">
                      <div class="mugua-strip-row">
                        <div
                          v-for="(item, si) in serverRecommendList"
                          :key="`${String(item.id ?? si)}-${si}`"
                          class="mugua-strip-item mugua-strip-item--clickable mugua-strip-item--lg"
                          role="button"
                          tabindex="0"
                          @click="onStripItemClick(item, si)"
                          @keydown.enter.prevent="onStripItemClick(item, si)"
                        >
                          <div class="mugua-strip-cover-wrap">
                            <img
                              v-if="item.cover"
                              class="mugua-strip-cover"
                              :src="String(item.cover)"
                              alt=""
                            />
                            <div v-else class="mugua-strip-cover mugua-strip-cover--ph" />
                            <span
                              v-if="item.playCount != null || item.count != null"
                              class="mugua-strip-pill"
                            >{{
                              String(item.playCount ?? item.count)
                            }}</span>
                          </div>
                          <div class="mugua-strip-meta">
                            <span class="mugua-strip-name">{{ item.name }}</span>
                            <span class="mugua-strip-artist">{{ item.artist }}</span>
                          </div>
                        </div>
                      </div>
                    </el-scrollbar>
                    <el-empty
                      v-else-if="!serverHomeLoading"
                      description="暂无推荐"
                      :image-size="40"
                    />
                  </div>
                  <div class="mu-sec-t mu-sec-t--row">
                    <span>猜你心动</span>
                    <el-button text class="mu-link" size="small" @click="loadBloggerRecommend">刷新</el-button>
                  </div>
                  <div v-loading="bloggerLoading" class="mu-card mu-card--pad">
                    <el-table
                      :data="bloggerRecommendList"
                      max-height="200"
                      class="mu-table"
                      style="width: 100%"
                      :row-class-name="bloggerRowClassName"
                      :empty-text="bloggerLoading ? '加载中…' : '暂无数据'"
                      @row-dblclick="onBloggerRowDblClick"
                    >
                      <el-table-column width="44">
                        <template #default="{ row }">
                          <el-icon
                            v-if="
                              player.playbackSource === 'remote' &&
                              String(row.id) === player.currentRemoteSong?.id &&
                              player.isPlaying
                            "
                            color="var(--mu-primary)"
                          >
                            <VideoPlay />
                          </el-icon>
                          <el-icon
                            v-else-if="
                              player.playbackSource === 'remote' &&
                              String(row.id) === player.currentRemoteSong?.id
                            "
                          >
                            <VideoPause />
                          </el-icon>
                        </template>
                      </el-table-column>
                      <el-table-column label="歌曲" min-width="160" show-overflow-tooltip>
                        <template #default="{ row }">{{ row.name }}</template>
                      </el-table-column>
                      <el-table-column label="歌手" width="120" show-overflow-tooltip>
                        <template #default="{ row }">{{ row.artist }}</template>
                      </el-table-column>
                      <el-table-column label="专辑" min-width="120" show-overflow-tooltip>
                        <template #default="{ row }">{{ row.albumName ?? row.album }}</template>
                      </el-table-column>
                      <el-table-column label="时长" width="72">
                        <template #default="{ row }">
                          {{ formatDur(Number(row.durationSec ?? row.duration ?? 0)) }}
                        </template>
                      </el-table-column>
                    </el-table>
                  </div>
                  <div class="mu-sec-t">在线音乐</div>
                  <div class="mu-card mu-card--pad mu-card--flex">
                    <OnlineMusicPanel />
                  </div>
                </template>
                <div v-else class="mu-card mu-card--pad mu-hall-soon">
                  <el-empty description="敬请期待" :image-size="64" />
                </div>
              </div>

              <div v-show="sideNav === 'lib'" class="mu-page">
                <div class="mu-hub mu-card">
                  <div class="mu-hub-t">乐库</div>
                  <p class="mu-hub-d">管理本地与在线音乐，快速开始</p>
                  <div class="mu-hub-grid">
                    <div class="mu-hub-tile" @click="goNav('local')">
                      <el-icon class="mu-hub-tile-ic" :size="30"><Headset /></el-icon>
                      <div class="mu-hub-tile-t">本地歌曲</div>
                      <p class="mu-hub-tile-s">{{ lib.tracks.length }} 首</p>
                    </div>
                    <div class="mu-hub-tile" @click="onImport">
                      <el-icon class="mu-hub-tile-ic" :size="30"><FolderOpened /></el-icon>
                      <div class="mu-hub-tile-t">导入音乐</div>
                      <p class="mu-hub-tile-s">从文件夹添加</p>
                    </div>
                    <div class="mu-hub-tile" @click="goNav('history')">
                      <el-icon class="mu-hub-tile-ic" :size="30"><Clock /></el-icon>
                      <div class="mu-hub-tile-t">最近播放</div>
                      <p class="mu-hub-tile-s">继续收听</p>
                    </div>
                    <div class="mu-hub-tile" @click="goNav('liked')">
                      <el-icon class="mu-hub-tile-ic" :size="30"><Star /></el-icon>
                      <div class="mu-hub-tile-t">我喜欢</div>
                      <p class="mu-hub-tile-s">{{ lib.likedTrackIds.length }} 首</p>
                    </div>
                  </div>
                </div>
              </div>

              <div v-show="isListView" class="mu-page">
                <div v-if="isPlaylistView" class="mu-card mu-pl-hero">
                  <div class="mu-pl-cover">
                    <img
                      v-if="plHeroCoverUrl"
                      :src="plHeroCoverUrl"
                      alt=""
                    />
                    <div v-else class="mu-pl-cover--ph">
                      <el-icon :size="40"><Collection /></el-icon>
                    </div>
                  </div>
                  <div class="mu-pl-text">
                    <h2 class="mu-pl-h">{{ browsePlaylistName }}</h2>
                    <p class="mu-pl-line">
                      共 {{ currentPlaylist?.trackIds.length ?? 0 }} 首
                      <span v-if="currentPlaylist" class="mu-pl-dot">·</span>
                      自建歌单
                    </p>
                    <p class="mu-pl-desc">本地收藏的音乐列表，可拖拽排序、双击播放。</p>
                    <div class="mu-pl-actions">
                      <el-button size="small" :icon="RefreshRight" @click="renamePlaylist">重命名</el-button>
                      <el-button size="small" type="danger" :icon="Close" @click="deletePlaylist">删除</el-button>
                    </div>
                  </div>
                </div>

                <div v-else class="mu-card mu-card--listhead">
                  <h2 class="mu-list-t">{{ listViewTitle }}</h2>
                  <div class="mu-list-actions">
                    <el-button
                      v-if="sideNav === 'local'"
                      class="mu-btn-imp"
                      type="primary"
                      :icon="FolderOpened"
                      @click="onImport"
                    >导入</el-button>
                    <el-dropdown
                      v-if="lib.playlists.length && lib.filteredTracks.length"
                      trigger="click"
                      @command="onAddToPlaylist"
                    >
                      <el-button size="small" plain>加入歌单</el-button>
                      <template #dropdown>
                        <el-dropdown-menu>
                          <el-dropdown-item v-for="pl in lib.playlists" :key="pl.id" :command="pl.id">
                            {{ pl.name }}
                          </el-dropdown-item>
                        </el-dropdown-menu>
                      </template>
                    </el-dropdown>
                  </div>
                </div>

                <div v-if="showLocalFilters" class="mu-card mu-filters">
                  <el-button
                    :type="lib.browse.kind === 'all' ? 'primary' : 'default'"
                    size="small"
                    @click="lib.browse = { kind: 'all' }"
                  >全部</el-button>
                  <el-select
                    :model-value="lib.browse.kind === 'artist' ? lib.browse.key : ''"
                    placeholder="歌手"
                    filterable
                    clearable
                    class="mu-fsel"
                    @change="onFilterArtist"
                  >
                    <el-option v-for="a in lib.artists" :key="a" :label="a" :value="a" />
                  </el-select>
                  <el-select
                    :model-value="lib.browse.kind === 'album' ? lib.browse.key : ''"
                    placeholder="专辑"
                    filterable
                    clearable
                    class="mu-fsel"
                    @change="onFilterAlbum"
                  >
                    <el-option v-for="a in lib.albums" :key="a" :label="a" :value="a" />
                  </el-select>
                  <el-select
                    :model-value="lib.browse.kind === 'folder' ? lib.browse.key : ''"
                    placeholder="文件夹"
                    filterable
                    clearable
                    class="mu-fsel"
                    @change="onFilterFolder"
                  >
                    <el-option v-for="f in lib.folders" :key="f" :label="f" :value="f" />
                  </el-select>
                </div>

                <div class="mu-card mu-card--table">
                  <el-table
                    ref="tableRef"
                    :data="lib.filteredTracks"
                    :height="tableHeight"
                    class="mu-table"
                    :row-class-name="rowClassName"
                    @row-dblclick="onLocalRowDblClick"
                  >
                    <el-table-column width="44" align="center">
                      <template #default="{ row }">
                        <button type="button" class="mu-like-btn" @click.stop="lib.toggleLike(row.id)">
                          <el-icon
                            v-if="lib.isLiked(row.id)"
                            class="mu-like-on"
                            :size="16"
                          >
                            <StarFilled />
                          </el-icon>
                          <el-icon v-else :size="16" class="mu-like-off"><Star /></el-icon>
                        </button>
                      </template>
                    </el-table-column>
                    <el-table-column width="44" align="center">
                      <template #default="{ row }">
                        <el-icon
                          v-if="row.id === player.currentId && player.isPlaying"
                          color="var(--mu-primary)"
                        >
                          <VideoPlay />
                        </el-icon>
                        <el-icon v-else-if="row.id === player.currentId">
                          <VideoPause />
                        </el-icon>
                      </template>
                    </el-table-column>
                    <el-table-column prop="title" label="歌曲" min-width="200" show-overflow-tooltip />
                    <el-table-column prop="artist" label="歌手" min-width="120" show-overflow-tooltip />
                    <el-table-column prop="album" label="专辑" min-width="140" show-overflow-tooltip />
                    <el-table-column label="时长" width="80">
                      <template #default="{ row }">
                        {{ formatDur(row.durationSec) }}
                      </template>
                    </el-table-column>
                  </el-table>
                </div>
              </div>
            </div>

            <aside v-show="lyricsOpen" class="mu-lyric-aside">
              <div class="mu-lyric-hd">歌词</div>
              <div ref="lyricScrollRef" class="mugua-lyrics">
                <template v-if="lrcLines.length">
                  <div
                    v-for="(line, idx) in lrcLines"
                    :key="idx"
                    :data-lrc="idx"
                    class="mugua-lyric-line"
                    :class="{ 'mugua-lyric-active': idx === currentLrcIndex }"
                    :style="{ color: lyricColor, fontSize: lyricFontSize }"
                  >
                    {{ line.text }}
                  </div>
                </template>
                <el-empty v-else description="暂无歌词" :image-size="40" />
              </div>
            </aside>
          </div>
        </div>
      </div>

      <footer class="mugua-player mu-player-dock">
        <div class="mugua-player-left">
          <img v-if="coverUrl" class="mugua-mini-cover" :src="coverUrl" alt="" />
          <div v-else class="mugua-mini-cover mugua-mini-cover--ph">
            <el-icon><Headset /></el-icon>
          </div>
          <div class="mugua-now-mini">
            <div class="mugua-now-title">{{ player.nowPlayingTitle }}</div>
            <div class="mugua-now-sub">{{ player.nowPlayingArtist }}</div>
          </div>
        </div>
        <div class="mugua-player-center">
          <div class="mugua-controls">
            <el-button
              class="mu-ctrl-skip"
              circle
              :icon="ArrowLeft"
              @click="goPrev"
            />
            <el-button
              class="mu-play-main"
              circle
              type="primary"
              @click="player.isPlaying = !player.isPlaying"
            >
              <el-icon :size="24"><VideoPause v-if="player.isPlaying" /><VideoPlay v-else /></el-icon>
            </el-button>
            <el-button
              class="mu-ctrl-skip"
              circle
              :icon="ArrowRight"
              @click="goNext"
            />
            <el-button text class="mu-loop" @click="cycleLoop">{{ loopLabel }}</el-button>
          </div>
          <div class="mugua-progress mu-player-prog">
            <span class="mugua-time">{{ formatDur(player.currentTimeSec) }}</span>
            <el-slider
              class="mu-prog-slider"
              :model-value="player.currentTimeSec"
              :max="Math.max(player.durationSec || 1, 1)"
              :show-tooltip="false"
              @input="onSeekBarInput"
            />
            <span class="mugua-time">{{ formatDur(player.durationSec) }}</span>
          </div>
        </div>
        <div class="mugua-player-right">
          <el-button
            circle
            :type="lyricsOpen ? 'primary' : 'default'"
            :icon="ChatLineRound"
            title="歌词"
            @click="lyricsOpen = !lyricsOpen"
          />
          <el-button
            circle
            :icon="Mute"
            @click="
              player.muted = !player.muted;
              void lib.updateSettings({ muted: player.muted, volume: player.volume })
            "
          />
          <el-slider
            v-model="player.volume"
            class="mu-vol-inline"
            :max="1"
            :step="0.01"
            :show-tooltip="false"
            @change="() => lib.updateSettings({ volume: player.volume, muted: player.muted })"
          />
        </div>
      </footer>

      <audio
        ref="audioRef"
        @timeupdate="onAudioTime"
        @ended="onAudioEnded"
        @play="onAudioPlay"
      />

      <el-dialog v-model="settingsVisible" title="设置" width="520px">
        <el-form v-if="lib.settings" label-width="140px">
          <el-form-item label="主题">
            <el-radio-group v-model="lib.settings.theme" @change="() => lib.updateSettings({ theme: lib.settings!.theme })">
              <el-radio-button label="system">跟随系统</el-radio-button>
              <el-radio-button label="light">浅色</el-radio-button>
              <el-radio-button label="dark">深色</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="关闭到托盘">
            <el-switch
              v-model="lib.settings.minimizeToTrayOnClose"
              @change="() => lib.updateSettings({ minimizeToTrayOnClose: lib.settings!.minimizeToTrayOnClose })"
            />
          </el-form-item>
          <el-form-item label="全局快捷键">
            <el-switch
              v-model="lib.settings.globalShortcutsEnabled"
              @change="() => lib.updateSettings({ globalShortcutsEnabled: lib.settings!.globalShortcutsEnabled })"
            />
            <div class="mugua-hint">Ctrl/Cmd + 左右：切歌；Ctrl/Cmd + 上下：音量</div>
          </el-form-item>
          <el-form-item label="歌词字号">
            <el-slider v-model="lib.settings.lyricFontSize" :min="12" :max="28" @change="() => lib.updateSettings({ lyricFontSize: lib.settings!.lyricFontSize })" />
          </el-form-item>
          <el-form-item label="歌词颜色（浅）">
            <el-color-picker
              v-model="lib.settings.lyricColorLight"
              @change="() => lib.updateSettings({ lyricColorLight: lib.settings!.lyricColorLight })"
            />
          </el-form-item>
          <el-form-item label="歌词颜色（深）">
            <el-color-picker
              v-model="lib.settings.lyricColorDark"
              @change="() => lib.updateSettings({ lyricColorDark: lib.settings!.lyricColorDark })"
            />
          </el-form-item>
          <el-form-item label="播放记录">
            <el-button @click="lib.clearHistory()">清空最近播放</el-button>
          </el-form-item>
          <el-form-item label="更新">
            <el-button @click="onCheckUpdate">检查更新</el-button>
          </el-form-item>
        </el-form>
      </el-dialog>
    </div>
  </el-config-provider>
</template>
