/**
 * 网易云音乐平台解析器
 * 
 * API逆向参考:
 * - WeAPI加密: AES-CBC双重加密 + RSA
 * - 主要端点: /weapi/v6/playlist/detail, /weapi/song/enhance/player/url/v1
 * - 分享链接格式: https://music.163.com/playlist?id=xxx 或短链 163cn.tv/xxx
 */
import { weApiEncrypt } from '../utils/crypto.js'
import { createNeteaseClient, requestWithRetry } from '../utils/http.js'
import type { PlatformParser, ParseResult, Playlist, Song, AudioSource } from '../types/index.js'
import { Platform, Quality } from '../types/index.js'

export class NeteaseParser implements PlatformParser {
  platform = Platform.Netease
  private cookies: string

  constructor(cookies = '') {
    this.cookies = cookies
  }

  /** 匹配网易云音乐链接 */
  match(url: string): boolean {
    return /music\.163\.com|163cn\.tv|163\.cn/.test(url)
  }

  /** 解析分享链接 */
  async parseShareUrl(url: string): Promise<ParseResult> {
    // 处理短链接跳转
    const finalUrl = await this.resolveShortUrl(url)

    // 提取类型和ID
    const playlistMatch = finalUrl.match(/playlist[?/].*?id=(\d+)/)
    const songMatch = finalUrl.match(/song[?/].*?id=(\d+)/)
    const albumMatch = finalUrl.match(/album[?/].*?id=(\d+)/)

    if (playlistMatch) {
      return { type: 'playlist', platform: Platform.Netease, id: playlistMatch[1] }
    }
    if (songMatch) {
      return { type: 'song', platform: Platform.Netease, id: songMatch[1] }
    }
    if (albumMatch) {
      return { type: 'album', platform: Platform.Netease, id: albumMatch[1] }
    }

    throw new Error(`无法解析网易云链接: ${url}`)
  }

  /** 获取歌单详情 */
  async getPlaylist(id: string): Promise<Playlist> {
    const client = createNeteaseClient(this.cookies)
    const data = weApiEncrypt({
      id,
      n: 100000, // 获取所有歌曲
      s: 8,      // 收藏者数量
    })

    const resp = await requestWithRetry(() =>
      client.post('/weapi/v6/playlist/detail', new URLSearchParams(data as Record<string, string>).toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
    )

    const result = resp.data
    if (result.code !== 200) {
      throw new Error(`获取歌单失败: ${result.message || result.code}`)
    }

    const playlist = result.playlist
    const songs: Song[] = (playlist.tracks || []).map((track: any) => this.mapTrack(track))

    return {
      id,
      name: playlist.name,
      description: playlist.description,
      cover: playlist.coverImgUrl,
      creator: playlist.creator?.nickname,
      platform: Platform.Netease,
      songs,
      songCount: playlist.trackCount,
    }
  }

  /** 搜索歌曲 */
  async search(keyword: string, page = 1): Promise<Song[]> {
    const client = createNeteaseClient(this.cookies)
    const data = weApiEncrypt({
      s: keyword,
      type: 1,        // 1=歌曲
      limit: 30,
      offset: (page - 1) * 30,
    })

    const resp = await requestWithRetry(() =>
      client.post('/weapi/cloudsearch/get/web', new URLSearchParams(data as Record<string, string>).toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
    )

    const result = resp.data
    if (result.code !== 200) return []

    return (result.result?.songs || []).map((track: any) => this.mapTrack(track))
  }

  /** 获取歌曲播放URL */
  async getSongUrl(song: Song, quality = Quality.HQ): Promise<AudioSource | null> {
    const client = createNeteaseClient(this.cookies)
    const level = this.qualityToLevel(quality)

    const data = weApiEncrypt({
      ids: [song.platformId],
      level,
      encodeType: 'flac',
    })

    const resp = await requestWithRetry(() =>
      client.post('/weapi/song/enhance/player/url/v1', new URLSearchParams(data as Record<string, string>).toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
    )

    const result = resp.data
    if (result.code !== 200) return null

    const songData = result.data?.[0]
    if (!songData?.url) return null

    return {
      url: songData.url,
      quality: this.brToQuality(songData.br),
      format: songData.type || 'mp3',
      size: songData.size,
      sourceName: '网易云音乐',
      bitrate: Math.floor(songData.br / 1000),
    }
  }

  /** 设置Cookie（登录后） */
  setCookies(cookies: string) {
    this.cookies = cookies
  }

  // ---- 私有方法 ----

  private async resolveShortUrl(url: string): Promise<string> {
    if (/163cn\.tv|163\.cn/.test(url)) {
      try {
        const resp = await createNeteaseClient().get(url, {
          maxRedirects: 0,
          validateStatus: (s) => s >= 200 && s < 400,
        })
        return resp.headers.location || url
      } catch (err: any) {
        if (err.response?.headers?.location) {
          return err.response.headers.location
        }
      }
    }
    return url
  }

  private mapTrack(track: any): Song {
    return {
      id: `netease_${track.id}`,
      name: track.name,
      artists: (track.ar || track.artists || []).map((a: any) => a.name),
      album: track.al?.name || track.album?.name || '',
      duration: Math.floor((track.dt || track.duration || 0) / 1000),
      platform: Platform.Netease,
      platformId: String(track.id),
      cover: track.al?.picUrl || track.album?.picUrl,
    }
  }

  private qualityToLevel(quality: Quality): string {
    switch (quality) {
      case Quality.Lossless: return 'lossless'
      case Quality.HQ: return 'exhigh'
      case Quality.Standard: return 'standard'
      default: return 'exhigh'
    }
  }

  private brToQuality(br: number): Quality {
    if (br >= 900000) return Quality.Lossless
    if (br >= 320000) return Quality.HQ
    return Quality.Standard
  }
}
