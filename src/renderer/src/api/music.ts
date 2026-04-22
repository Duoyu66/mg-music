/**
 * 与 web_f `src/api/f/music.ts` 保持相同路径与方法，便于共用后端。
 * 依赖 {@link ./http} 实例。
 */
import { http } from './http'

export const reqFavoriteList = (data: Record<string, unknown>) =>
  http.post('/api/music/getFavoriteSongs', data, {
    headers: { 'Content-Type': 'application/json' }
  })

export const reqFavoriteSingers = () =>
  http.post('/api/music/getSingerList', undefined, {
    headers: { 'Content-Type': 'application/json' }
  })

export const reqSingerAlbum = (data: Record<string, unknown>) =>
  http.post('/api/music/getAlbumBySinger', data, {
    headers: { 'Content-Type': 'application/json' }
  })

export const reqGetAlbumSongs = (data: Record<string, unknown>) =>
  http.post('/api/music/getAlbumSongs', data, {
    headers: { 'Content-Type': 'application/json' }
  })

export const reqUpdateSongStatistics = (data: Record<string, unknown>) =>
  http.post('/api/music/updateSongCount', data, {
    headers: { 'Content-Type': 'application/json' }
  })

export const reqGetRecentSongs = (data: Record<string, unknown>) =>
  http.post('/api/music/getRecentSongs', data, {
    headers: { 'Content-Type': 'application/json' }
  })

/** 首页：推荐 / 热门歌手 / 热榜（与 web_f MusicHome 一致） */
export const reqGetMusicHomeInfo = (data: Record<string, unknown>) =>
  http.post('/api/music/getMusicHomeInfo', data, {
    headers: { 'Content-Type': 'application/json' }
  })

export const reqSearchSongByKeywords = (data: Record<string, unknown>) =>
  http.post('/api/music/searchSong', data, {
    headers: { 'Content-Type': 'application/json' }
  })

export const reqSearchSongRescource = (data: Record<string, unknown>) =>
  http.post('/api/music/playSearchSong', data, {
    headers: { 'Content-Type': 'application/json' }
  })

export const reqGetLikeSongs = (data: Record<string, unknown>) =>
  http.post('/api/music/getLikeSongs', data, {
    headers: { 'Content-Type': 'application/json' }
  })

export const reqUpdateMusLike = (data: Record<string, unknown>) =>
  http.post('/api/music/updateMusLike', data, {
    headers: { 'Content-Type': 'application/json' }
  })

export const reqGetSongsBySinger = (data: Record<string, unknown>) =>
  http.post('/api/music/getSongsBySinger', data, {
    headers: { 'Content-Type': 'application/json' }
  })

export const reqGetSingerAndCollect = () =>
  http.post('/api/music/getSingerAndCollect', undefined, {
    headers: { 'Content-Type': 'application/json' }
  })

export const reqGroupSearchSong = (data: Record<string, unknown>) =>
  http.post('/api/music/groupSearchSong', data, {
    headers: { 'Content-Type': 'application/json' }
  })

export const reqSingerInfo = (data: Record<string, unknown>) =>
  http.post('/api/music/getSingerInfo', data, {
    headers: { 'Content-Type': 'application/json' }
  })

/** 网易搜索（后端转发） */
export const reqWySearch = (data: Record<string, unknown>) =>
  http.post('/api/music/searchWySong', data, {
    headers: { 'Content-Type': 'application/json' }
  })
