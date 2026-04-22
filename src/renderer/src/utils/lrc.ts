/** 解析 LRC：返回 { timeSec, text }[]，按时间排序 */

export interface LrcLine {
  timeSec: number
  text: string
}

const LINE_RE = /^\[(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?\](.*)$/

export function parseLrc(text: string): LrcLine[] {
  const lines: LrcLine[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const m = line.match(LINE_RE)
    if (!m) continue
    const mm = Number(m[1])
    const ss = Number(m[2])
    const frac = m[3] ? Number(m[3]) / (m[3].length === 3 ? 1000 : 100) : 0
    const timeSec = mm * 60 + ss + frac
    const content = (m[4] ?? '').trim()
    if (content) lines.push({ timeSec, text: content })
  }
  lines.sort((a, b) => a.timeSec - b.timeSec)
  return lines
}

/** 根据当前时间取应高亮行索引 */
export function activeLrcIndex(lines: LrcLine[], currentSec: number): number {
  if (!lines.length) return -1
  let lo = 0
  let hi = lines.length - 1
  let ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (lines[mid].timeSec <= currentSec) {
      ans = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return ans
}
