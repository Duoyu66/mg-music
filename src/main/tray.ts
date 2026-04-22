import { Menu, Tray, nativeImage } from 'electron'
import type { BrowserWindow } from 'electron'

let tray: Tray | null = null

/** 创建简单占位托盘图标（无资源文件时） */
function buildTrayImage(): Electron.NativeImage {
  const size = 16
  const buf = Buffer.alloc(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    const o = i * 4
    buf[o] = 90
    buf[o + 1] = 180
    buf[o + 2] = 120
    buf[o + 3] = 255
  }
  return nativeImage.createFromBuffer(buf, { width: size, height: size })
}

export function getTray() {
  return tray
}

export function createTray(win: BrowserWindow, actions: { togglePlay: () => void; quit: () => void }) {
  if (tray) return tray
  tray = new Tray(buildTrayImage())
  tray.setToolTip('木瓜音乐')
  const menu = Menu.buildFromTemplate([
    {
      label: '播放 / 暂停',
      click: () => actions.togglePlay()
    },
    { type: 'separator' },
    {
      label: '显示主窗口',
      click: () => {
        win.show()
        win.focus()
      }
    },
    {
      label: '退出',
      click: () => actions.quit()
    }
  ])
  tray.setContextMenu(menu)
  tray.on('click', () => {
    win.show()
    win.focus()
  })
  return tray
}

export function destroyTray() {
  if (tray) {
    tray.destroy()
    tray = null
  }
}
