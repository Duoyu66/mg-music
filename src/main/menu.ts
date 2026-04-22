import { Menu, app, shell } from 'electron'
import type { BrowserWindow } from 'electron'

export function buildAppMenu(_win: BrowserWindow, playback: { toggle: () => void; next: () => void; prev: () => void }) {
  const playbackMenu: Electron.MenuItemConstructorOptions[] = [
    {
      label: '播放 / 暂停',
      accelerator: 'Space',
      click: () => playback.toggle()
    },
    {
      label: '上一曲',
      accelerator: 'CommandOrControl+Left',
      click: () => playback.prev()
    },
    {
      label: '下一曲',
      accelerator: 'CommandOrControl+Right',
      click: () => playback.next()
    }
  ]

  if (process.platform === 'darwin') {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      },
      {
        label: '编辑',
        submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }]
      },
      { label: '播放', submenu: playbackMenu },
      {
        label: '窗口',
        submenu: [{ role: 'minimize' }, { role: 'zoom' }, { type: 'separator' }, { role: 'front' }]
      },
      {
        label: '帮助',
        submenu: [
          {
            label: '在浏览器打开示例链接',
            click: async () => {
              await shell.openExternal('https://github.com')
            }
          }
        ]
      }
    ]
    Menu.setApplicationMenu(Menu.buildFromTemplate(template))
  } else {
    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: '文件',
        submenu: [{ role: 'quit' }]
      },
      { label: '播放', submenu: playbackMenu },
      {
        label: '帮助',
        submenu: [
          {
            label: '在浏览器打开示例链接',
            click: async () => {
              await shell.openExternal('https://github.com')
            }
          }
        ]
      }
    ]
    Menu.setApplicationMenu(Menu.buildFromTemplate(template))
  }
}
