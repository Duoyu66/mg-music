import { reqSearchSongRescource } from '@renderer/api/music'
import {
  artistToString,
  rawToRemoteSong,
  type RemoteSong
} from '@renderer/types/remote-song'

/** 与 web_f TableSong type 0 一致：有 url 则直播；否则走 playSearchSong 取可播地址 */
export async function resolveRemoteSongForPlayback(
  raw: Record<string, unknown>
): Promise<RemoteSong | null> {
  const direct = rawToRemoteSong(raw)
  if (direct) return direct
  const id = raw.id != null ? String(raw.id) : ''
  if (!id) return null
  const res = (await reqSearchSongRescource({
    songId: id,
    singerId: typeof raw.mainSingerId === 'string' ? raw.mainSingerId : '',
    name: raw.name,
    cover: raw.cover,
    artist: artistToString(raw.artist),
    albumName:
      (typeof raw.albumName === 'string' && raw.albumName) ||
      (typeof raw.album === 'string' && raw.album) ||
      ''
  })) as { status?: boolean; data?: Record<string, unknown> }
  if (!res?.status || !res.data) return null
  return rawToRemoteSong(res.data as Record<string, unknown>)
}

export async function resolveQueueForPlayback(
  raws: Record<string, unknown>[]
): Promise<RemoteSong[]> {
  const out = await Promise.all(raws.map((r) => resolveRemoteSongForPlayback(r)))
  return out.filter((x): x is RemoteSong => x != null)
}
