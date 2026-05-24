/** API 客户端 */

const BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = await resp.json()
  if (data.code !== 0) {
    throw new Error(data.message || '请求失败')
  }
  return data.data
}

export interface Song {
  id: string
  name: string
  artists: string[]
  album: string
  duration: number
  platform: string
  platformId: string
  cover?: string
}

export interface Playlist {
  id: string
  name: string
  description?: string
  cover?: string
  creator?: string
  platform: string
  songs: Song[]
  songCount: number
}

export interface AudioSource {
  url: string
  quality: string
  format: string
  size?: number
  sourceName: string
  bitrate?: number
}

export interface ParseResult {
  type: 'playlist' | 'song' | 'album'
  platform: string
  id: string
}

/** 解析分享链接 */
export function parseUrl(url: string): Promise<ParseResult> {
  return request('/parse', {
    method: 'POST',
    body: JSON.stringify({ url }),
  })
}

/** 获取歌单 */
export function getPlaylist(url: string): Promise<Playlist> {
  return request('/playlist', {
    method: 'POST',
    body: JSON.stringify({ url }),
  })
}

/** 获取歌单（通过平台+ID） */
export function getPlaylistById(platform: string, id: string): Promise<Playlist> {
  return request('/playlist', {
    method: 'POST',
    body: JSON.stringify({ platform, id }),
  })
}

/** 搜索歌曲 */
export function searchSongs(keyword: string, platform?: string, page = 1): Promise<Song[]> {
  const params = new URLSearchParams({ keyword, page: String(page) })
  if (platform) params.set('platform', platform)
  return request(`/search?${params}`)
}

/** 获取歌曲音源 */
export function getSongSources(song: Song, quality = 'hq'): Promise<AudioSource[]> {
  return request('/source', {
    method: 'POST',
    body: JSON.stringify({ song, quality }),
  })
}

/** 批量获取歌单音源 */
export function getPlaylistSources(url: string, quality = 'hq'): Promise<{ total: number; sources: Record<string, AudioSource[]> }> {
  return request('/playlist/sources', {
    method: 'POST',
    body: JSON.stringify({ url, quality }),
  })
}

/** 设置平台Cookie */
export function setCookie(platform: string, cookies: string, uin?: string): Promise<void> {
  return request('/auth/cookie', {
    method: 'POST',
    body: JSON.stringify({ platform, cookies, uin }),
  })
}
