/**
 * 开发时 macOS Dock / 程序坞悬停会读 `Electron.app` 的 Info.plist，与代码中 app.setName 无关。
 * 从 node_modules 复制 dist 到 dev-electron-dist 并改 CFBundleName，配合 ELECTRON_OVERRIDE_DIST_PATH 使用。
 * @see https://github.com/electron/electron/issues/19892
 */
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

if (process.platform !== 'darwin') {
  process.exit(0)
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const srcDist = join(root, 'node_modules', 'electron', 'dist')
const destDist = join(root, 'dev-electron-dist')
const pkgPath = join(root, 'node_modules', 'electron', 'package.json')
const version = JSON.parse(readFileSync(pkgPath, 'utf-8')).version
const versionFile = join(destDist, '.electron-version')
const mainPlist = join(destDist, 'Electron.app', 'Contents', 'Info.plist')

if (!existsSync(srcDist)) {
  console.error('[ensure-macos-electron-rebrand] 未找到', srcDist)
  process.exit(1)
}

const needCopy =
  !existsSync(versionFile) || readFileSync(versionFile, 'utf-8').trim() !== version || !existsSync(mainPlist)

if (needCopy) {
  if (existsSync(destDist)) {
    rmSync(destDist, { recursive: true, force: true })
  }
  cpSync(srcDist, destDist, { recursive: true })
  writeFileSync(versionFile, `${version}\n`, 'utf-8')
  console.log('[dev] 已准备 dev-electron-dist（Electron ' + version + '），并写入显示名为「木瓜音乐」')
}

const DISPLAY = '木瓜音乐'
const buddy = (cmd) => {
  execFileSync('/usr/libexec/PlistBuddy', ['-c', cmd, mainPlist], { stdio: 'inherit' })
}
buddy(`Set :CFBundleName ${DISPLAY}`)
buddy(`Set :CFBundleDisplayName ${DISPLAY}`)
