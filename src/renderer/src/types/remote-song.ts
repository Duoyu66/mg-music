/** 在线播放（与 web_f MusicAudio 使用的 song.url 一致，不写入本地曲库） */
export interface RemoteSong {
  id: string
  url: string
  title: string
  artist: string
  album: string
  cover?: string
  durationSec?: number
  lrc?: string
}

export function artistToString(v: unknown): string {
  if (Array.isArray(v)) return v.map(String).join('/')
  if (typeof v === 'string') return v
  return ''
}

/** 将接口返回的一条歌曲记录规范为 RemoteSong（已有 url 时可直接播放） */
export function rawToRemoteSong(raw: Record<string, unknown>): RemoteSong | null {
  const id = raw.id != null ? String(raw.id) : ''
  const url = typeof raw.url === 'string' ? raw.url : ''
  if (!id || !url) return null
  const title =
    (typeof raw.name === 'string' && raw.name) ||
    (typeof raw.title === 'string' && raw.title) ||
    '未知'
  const artist = artistToString(raw.artist)
  const album =
    (typeof raw.albumName === 'string' && raw.albumName) ||
    (typeof raw.album === 'string' && raw.album) ||
    ''
  const cover = typeof raw.cover === 'string' ? raw.cover : undefined
  const lrc = typeof raw.lrc === 'string' ? raw.lrc : undefined
  let durationSec = 0
  if (typeof raw.durationSec === 'number' && !Number.isNaN(raw.durationSec)) durationSec = raw.durationSec
  else if (typeof raw.duration === 'number' && !Number.isNaN(raw.duration)) durationSec = raw.duration
  return { id, url, title, artist, album, cover, durationSec, lrc }
}
