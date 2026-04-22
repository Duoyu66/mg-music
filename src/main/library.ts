import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, relative } from 'node:path'
import { parseFile } from 'music-metadata'
import type { BrowserWindow } from 'electron'
import { app } from 'electron'
import { IPC } from '../shared/ipc-channels'
import type { ScanProgress, Track } from '../shared/types'

const AUDIO_EXT = new Set(['.mp3', '.flac', '.wav', '.m4a'])

function trackIdForPath(filePath: string): string {
  return createHash('sha256').update(filePath).digest('hex').slice(0, 32)
}

/** 递归列出目录下所有音频文件路径 */
async function collectAudioFiles(root: string): Promise<string[]> {
  const out: string[] = []
  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const ent of entries) {
      const p = join(dir, ent.name)
      if (ent.isDirectory()) {
        await walk(p)
      } else if (ent.isFile()) {
        const ext = extname(ent.name).toLowerCase()
        if (AUDIO_EXT.has(ext)) out.push(p)
      }
    }
  }
  await walk(root)
  return out
}

async function ensureCoverFile(trackId: string, picture: Buffer, format?: string): Promise<string | undefined> {
  const dir = join(app.getPath('userData'), 'covers')
  await mkdir(dir, { recursive: true })
  const ext = format?.includes('png') ? 'png' : 'jpg'
  const name = `${trackId}.${ext}`
  const dest = join(dir, name)
  await writeFile(dest, picture)
  return name
}

export interface ParseOneResult {
  track: Track
  error?: string
}

/** 解析单个音频文件元数据并生成 Track */
export async function parseAudioFile(filePath: string, rootFolder: string): Promise<ParseOneResult> {
  const id = trackIdForPath(filePath)
  const folderKey = relative(rootFolder, dirname(filePath)) || basename(rootFolder)
  try {
    const meta = await parseFile(filePath, { duration: true })
    const title = meta.common.title?.trim() || basename(filePath, extname(filePath))
    const artist = meta.common.artist?.trim() || meta.common.artists?.[0]?.trim() || '未知歌手'
    const album = meta.common.album?.trim() || '未知专辑'
    const durationSec = Math.round(meta.format.duration ?? 0)
    let coverFile: string | undefined
    const pic = meta.common.picture?.[0]
    if (pic?.data?.length) {
      coverFile = await ensureCoverFile(id, Buffer.from(pic.data), pic.format)
    }
    const track: Track = {
      id,
      path: filePath,
      title,
      artist,
      album,
      durationSec,
      folderKey,
      coverFile
    }
    return { track }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      track: {
        id,
        path: filePath,
        title: basename(filePath, extname(filePath)),
        artist: '未知歌手',
        album: '未知专辑',
        durationSec: 0,
        folderKey,
        coverFile: undefined
      },
      error: msg
    }
  }
}

/** 扫描文件夹：列文件 + 解析元数据，并向窗口推送进度 */
export async function scanMusicFolder(
  rootFolder: string,
  win: BrowserWindow | null,
  existingPaths: Set<string>
): Promise<{ tracks: Track[]; errors: string[] }> {
  const files = await collectAudioFiles(rootFolder)
  const total = files.length
  const tracks: Track[] = []
  const errors: string[] = []
  let current = 0

  const send = (payload: ScanProgress) => {
    win?.webContents.send(IPC.event.libraryScanProgress, payload)
  }

  send({ current: 0, total, phase: 'listing' })

  for (const filePath of files) {
    current++
    send({ current, total, phase: 'metadata', currentFile: filePath })
    if (existingPaths.has(filePath)) continue
    const { track, error } = await parseAudioFile(filePath, rootFolder)
    tracks.push(track)
    if (error) errors.push(`${filePath}: ${error}`)
    existingPaths.add(filePath)
  }

  return { tracks, errors }
}

/** 尝试读取同目录下同名的 lrc 歌词 */
export async function tryReadLrcForTrack(audioPath: string): Promise<string | null> {
  const base = audioPath.replace(/\.[^.]+$/, '')
  const candidates = [`${base}.lrc`, `${base}.LRC`]
  for (const p of candidates) {
    try {
      const s = await stat(p)
      if (s.isFile()) {
        return readFile(p, 'utf-8')
      }
    } catch {
      /* 不存在则尝试下一候选 */
    }
  }
  return null
}

export { trackIdForPath }
