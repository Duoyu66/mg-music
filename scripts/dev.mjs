import { execFileSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

if (process.platform === 'darwin') {
  execFileSync('node', [join(root, 'scripts/ensure-macos-electron-rebrand.mjs')], { stdio: 'inherit' })
}

const env = { ...process.env }
if (process.platform === 'darwin') {
  env.ELECTRON_OVERRIDE_DIST_PATH = join(root, 'dev-electron-dist')
}

const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const child = spawn(pnpm, ['exec', 'electron-vite', 'dev'], {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
  cwd: root
})
child.on('exit', (code) => {
  process.exit(code == null ? 0 : code)
})
