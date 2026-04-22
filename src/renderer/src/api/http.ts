import axios, { type AxiosError, type AxiosRequestConfig } from 'axios'

/** 响应拦截器已返回 `res.data`，此处类型与运行时一致 */
export type HttpClient = {
  get: <T = unknown>(url: string, config?: AxiosRequestConfig) => Promise<T>
  post: <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig) => Promise<T>
}

/**
 * 与 web_f 中 `utils/requests.ts` 一致：统一 axios 实例。
 * 接口路径均为 `/api/music/...`（见 music.ts）。
 * - 开发：`baseURL` 为空时请求同源 `/api/...`，由 Vite 代理去掉 `/api` 前缀再转发到本机 8082 的 `/music/...`。
 * - 直连线上：`VITE_API_BASE` 为根地址，最终请求 `https://域名/api/music/...`（不再去掉 `/api`，与线上一致）。
 */
function resolveBaseURL(): string {
  const env = import.meta.env.VITE_API_BASE
  if (env != null && String(env).trim() !== '') {
    return String(env).trim().replace(/\/$/, '')
  }
  if (import.meta.env.DEV) {
    return ''
  }
  return 'http://127.0.0.1:8082'
}

const raw = axios.create({
  baseURL: resolveBaseURL(),
  timeout: 15_000
})

raw.interceptors.request.use((config) => {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

raw.interceptors.response.use(
  (res) => res.data,
  (err: AxiosError) => {
    const msg = err.response?.data
      ? String((err.response.data as { message?: string }).message ?? err.message)
      : err.message
    return Promise.reject(new Error(msg || '网络请求失败'))
  }
)

export const http = raw as HttpClient
