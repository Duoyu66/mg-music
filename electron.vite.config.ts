import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  main: {
    /**
     * 关闭「依赖全部 external」：把 music-metadata、electron-store、electron-updater 等打进 out/main/index.js。
     * 否则打 DMG 后 app.asar 里 pnpm 的 node_modules 不完整，会陆续报缺 ieee754、ms（debug）等模块。
     * electron / Node 内置模块仍由 electron-vite 默认 external，不会打进 bundle。
     */
    build: {
      externalizeDeps: false
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    /**
     * 项目为 "type":"module" 时，electron-vite 默认把 preload 打成 ESM（.mjs）。
     * 在 sandbox 下预加载脚本无法作为 ES module 执行，会报
     * "Cannot use import statement outside a module"，且 electronAPI 不会注入。
     * 强制 CJS 输出为 index.js。
     */
    build: {
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: 'index.js',
          chunkFileNames: '[name]-[hash].js'
        }
      }
    }
  },
  renderer: {
    /** 开发时仅渲染进程会起 Vite dev server，端口写在这里 */
    server: {
      port: 9000,
      /**
       * 与 web_f craco `pathRewrite: { '^/api': '' }` 一致：
       * 前端仍请求 `/api/music/...`，转发到后端时变为 `/music/...`，否则 Spring 会报 No mapping for POST /api/music/...
       */
      proxy: {
        '/api': {
          target: 'http://localhost:8082',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '')
        },
        '/wy': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/wy/, '')
        }
      }
    },
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer/src'),
        '@shared': resolve(__dirname, 'src/shared')
      }
    },
    plugins: [vue()]
  }
})
