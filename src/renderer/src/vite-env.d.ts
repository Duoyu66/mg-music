/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 后端根地址，如 https://api.example.com；开发留空可走 Vite 代理 */
  readonly VITE_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

declare global {
  interface Window {
    electronAPI: import('../../preload/index').ElectronAPI
  }
}

export {}
