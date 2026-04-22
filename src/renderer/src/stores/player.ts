import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { LoopMode, Track } from '@shared/types'
import type { RemoteSong } from '@renderer/types/remote-song'
import { useLibraryStore } from './library'

/** 播放队列与模式（与 HTMLAudioElement 在 App 中协同）；支持本地文件与在线 url */
export const usePlayerStore = defineStore('player', () => {
  const lib = useLibraryStore()

  const playbackSource = ref<'local' | 'remote'>('local')
  const remoteQueue = ref<RemoteSong[]>([])
  const remoteIndex = ref(0)

  const queueIds = ref<string[]>([])
  const queueIndex = ref(0)
  const loopMode = ref<LoopMode>('list')
  const isPlaying = ref(false)
  const currentTimeSec = ref(0)
  const durationSec = ref(0)
  const volume = ref(0.85)
  const muted = ref(false)

  const currentId = computed(() =>
    playbackSource.value === 'local' ? queueIds.value[queueIndex.value] ?? null : null
  )

  const currentRemoteSong = computed<RemoteSong | null>(() => {
    if (playbackSource.value !== 'remote') return null
    const q = remoteQueue.value
    const i = remoteIndex.value
    if (i < 0 || i >= q.length) return null
    return q[i]!
  })

  const currentTrack = computed<Track | null>(() => {
    if (playbackSource.value !== 'local') return null
    const id = currentId.value
    if (!id) return null
    return lib.trackMap.get(id) ?? null
  })

  const nowPlayingTitle = computed(
    () => currentRemoteSong.value?.title ?? currentTrack.value?.title ?? '未播放'
  )
  const nowPlayingArtist = computed(
    () => currentRemoteSong.value?.artist ?? currentTrack.value?.artist ?? '—'
  )

  function setQueue(ids: string[], startIndex = 0) {
    playbackSource.value = 'local'
    remoteQueue.value = []
    queueIds.value = [...ids]
    queueIndex.value = Math.min(Math.max(0, startIndex), Math.max(0, queueIds.value.length - 1))
  }

  /** 在线队列：用箭头函数挂在 return 上，避免部分环境下 function 声明未作为 action 暴露 */
  const setRemoteQueue = (songs: RemoteSong[], startIndex = 0) => {
    if (songs.length === 0) return
    playbackSource.value = 'remote'
    queueIds.value = []
    remoteQueue.value = songs.map((s) => ({ ...s }))
    remoteIndex.value = Math.min(Math.max(0, startIndex), songs.length - 1)
  }

  function applyFromSettings() {
    const s = lib.settings
    if (!s) return
    volume.value = s.volume
    muted.value = s.muted
    loopMode.value = s.defaultLoopMode
  }

  watch(
    () => lib.settings,
    () => applyFromSettings(),
    { immediate: true }
  )

  function pickNextIndexLocal(): number {
    const n = queueIds.value.length
    if (n === 0) return -1
    if (loopMode.value === 'shuffle') {
      return Math.floor(Math.random() * n)
    }
    if (loopMode.value === 'single') {
      return queueIndex.value
    }
    const next = queueIndex.value + 1
    if (next < n) return next
    if (loopMode.value === 'list') return 0
    return -1
  }

  function pickPrevIndexLocal(): number {
    const n = queueIds.value.length
    if (n === 0) return -1
    if (loopMode.value === 'shuffle') {
      return Math.floor(Math.random() * n)
    }
    const prev = queueIndex.value - 1
    if (prev >= 0) return prev
    if (loopMode.value === 'list') return n - 1
    return -1
  }

  function pickNextIndexRemote(): number {
    const n = remoteQueue.value.length
    if (n === 0) return -1
    if (loopMode.value === 'shuffle') {
      return Math.floor(Math.random() * n)
    }
    if (loopMode.value === 'single') {
      return remoteIndex.value
    }
    const next = remoteIndex.value + 1
    if (next < n) return next
    if (loopMode.value === 'list') return 0
    return -1
  }

  function pickPrevIndexRemote(): number {
    const n = remoteQueue.value.length
    if (n === 0) return -1
    if (loopMode.value === 'shuffle') {
      return Math.floor(Math.random() * n)
    }
    const prev = remoteIndex.value - 1
    if (prev >= 0) return prev
    if (loopMode.value === 'list') return n - 1
    return -1
  }

  function pickNextIndex(): number {
    return playbackSource.value === 'remote' ? pickNextIndexRemote() : pickNextIndexLocal()
  }

  function pickPrevIndex(): number {
    return playbackSource.value === 'remote' ? pickPrevIndexRemote() : pickPrevIndexLocal()
  }

  function advanceEnded() {
    if (playbackSource.value === 'remote') {
      const n = remoteQueue.value.length
      if (n === 0) return
      if (loopMode.value === 'single') {
        isPlaying.value = true
        return
      }
      const ni = pickNextIndexRemote()
      if (ni < 0) {
        isPlaying.value = false
        return
      }
      remoteIndex.value = ni
      isPlaying.value = true
      return
    }
    const n = queueIds.value.length
    if (n === 0) return
    if (loopMode.value === 'single') {
      isPlaying.value = true
      return
    }
    const ni = pickNextIndexLocal()
    if (ni < 0) {
      isPlaying.value = false
      return
    }
    queueIndex.value = ni
    isPlaying.value = true
  }

  function goNext() {
    const ni = pickNextIndex()
    if (ni < 0) {
      isPlaying.value = false
      return
    }
    if (playbackSource.value === 'remote') {
      remoteIndex.value = ni
    } else {
      queueIndex.value = ni
    }
    isPlaying.value = true
  }

  function goPrev() {
    const pi = pickPrevIndex()
    if (pi < 0) return
    if (playbackSource.value === 'remote') {
      remoteIndex.value = pi
    } else {
      queueIndex.value = pi
    }
    isPlaying.value = true
  }

  return {
    playbackSource,
    remoteQueue,
    remoteIndex,
    queueIds,
    queueIndex,
    loopMode,
    isPlaying,
    currentTimeSec,
    durationSec,
    volume,
    muted,
    currentId,
    currentTrack,
    currentRemoteSong,
    nowPlayingTitle,
    nowPlayingArtist,
    setQueue,
    setRemoteQueue,
    pickNextIndex,
    pickPrevIndex,
    advanceEnded,
    goNext,
    goPrev,
    applyFromSettings
  }
})
