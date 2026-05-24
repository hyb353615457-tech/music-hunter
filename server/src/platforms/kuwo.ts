/**
 * 酷我音乐平台解析器
 * 
 * API特点:
 * - 需要先获取csrf token (kw_token cookie)
 * - 主要端点: /api/www/playlist/playListInfo, /api/www/search/searchMusicBykeyWord
 * - 音频URL: /api/v1/www/music/playUrl?mid={id}&type=music&httpsStatus=1
 * - 分享链接: https://www.kuwo.cn/playlist_detail/xxx
 */
import { createKuwoClient, requestWithRetry, createHttpClient } from '../utils/http.js'
import type { PlatformParser, ParseResult, Playlist, Song, AudioSource } from '../types/index.js'
import { Platform, Quality } from '../types/index.js'

export class KuwoParser implements PlatformParser {
  platform = Platform.Kuwo
  private csrfToken = ''
  private cookies = ''

  constructor() {}

  match(url: string): boolean {
    return /kuwo\.cn/.test(url)
  }

  async parseShareUrl(url: string): Promise<ParseResult> {
    const playlistMatch = url.match(/playlist_detail[/](\d+)/)
    const songMatch = url.match(/play_detail[/](\d+)/)
    const albumMatch = url.match(/album_detail[/](\d+)/)

    if (playlistMatch) {
      return { type: 'playlist', platform: Platform.Kuwo, id: playlistMatch[1] }
    }
    if (songMatch) {
      return { type: 'song', platform: Platform.Kuwo, id: songMatch[1] }
    }
    if (albumMatch) {
      return { type: 'album', platform: Platform.Kuwo, id: albumMatch[1] }
    }

    throw new Error(`无法解析酷我链接: ${url}`)
  }

  async getPlaylist(id: string): Promise<Playlist> {
    await this.ensureCsrf()
    const client = this.getClient()

    const resp = await requestWithRetry(() =>
      client.get('/api/www/playlist/playListInfo', {
        params: { pid: id, pn: 1, rn: 1000 },
      })
    )

    const data = resp.data?.data
    if (!data) throw new Error('获取酷我歌单失败')

    const songs: Song[] = (data.musicList || []).map((item: any) => this.mapSong(item))

    return {
      id,
      name: data.name || '',
      description: data.info || '',
      cover: data.img || '',
      creator: data.uname || '',
      platform: Platform.Kuwo,
      songs,
      songCount: data.total || songs.length,
    }
  }

  async search(keyword: string, page = 1): Promise<Song[]> {
    await this.ensureCsrf()
    const client = this.getClient()

    const resp = await requestWithRetry(() =>
      client.get('/api/www/search/searchMusicBykeyWord', {
        params: { key: keyword, pn: page, rn: 30 },
      })
    )

    const list = resp.data?.data?.list || []
    return list.map((item: any) => this.mapSong(item))
  }

  async getSongUrl(song: Song, quality = Quality.HQ): Promise<AudioSource | null> {
    await this.ensureCsrf()
    const client = this.getClient()
    const br = this.qualityToBr(quality)

    const resp = await requestWithRetry(() =>
      client.get('/api/v1/www/music/playUrl', {
        params: {
          mid: song.platformId,
          type: 'music',
          httpsStatus: 1,
          br: br,
        },
      })
    )

    const data = resp.data?.data
    if (!data?.url) return null

    return {
      url: data.url,
      quality,
      format: this.getFormatFromUrl(data.url),
      sourceName: '酷我音乐',
      bitrate: quality === Quality.Lossless ? 900 : quality === Quality.HQ ? 320 : 128,
    }
  }

  // ---- 私有方法 ----

  /** 获取csrf token（酷我特有的反爬机制） */
  private async ensureCsrf() {
    if (this.csrfToken) return

    const client = createHttpClient()
    const resp = await client.get('https://www.kuwo.cn/', {
      maxRedirects: 5,
    })

    // 从Set-Cookie中提取kw_token
    const setCookies = resp.headers['set-cookie'] || []
    for (const cookie of setCookies) {
      const match = cookie.match(/kw_token=(\w+)/)
      if (match) {
        this.csrfToken = match[1]
        this.cookies = `kw_token=${match[1]}`
        return
      }
    }

    // 备用：生成随机token
    this.csrfToken = this.randomToken()
    this.cookies = `kw_token=${this.csrfToken}`
  }

  private getClient() {
    return createHttpClient({
      baseURL: 'https://www.kuwo.cn',
      headers: {
        'Referer': 'https://www.kuwo.cn/',
        'Cookie': this.cookies,
        'csrf': this.csrfToken,
      },
    })
  }

  private mapSong(item: any): Song {
    return {
      id: `kuwo_${item.rid || item.musicrid?.replace('MUSIC_', '')}`,
      name: item.name || '',
      artists: (item.artist || '').split('&').map((s: string) => s.trim()),
      album: item.album || '',
      duration: item.duration || 0,
      platform: Platform.Kuwo,
      platformId: String(item.rid || item.musicrid?.replace('MUSIC_', '')),
      cover: item.pic || item.albumpic || '',
    }
  }

  private qualityToBr(quality: Quality): string {
    switch (quality) {
      case Quality.Lossless: return '2000kflac'
      case Quality.HQ: return '320kmp3'
      case Quality.Standard: return '128kmp3'
      default: return '320kmp3'
    }
  }

  private getFormatFromUrl(url: string): string {
    if (url.includes('.flac')) return 'flac'
    if (url.includes('.m4a')) return 'm4a'
    return 'mp3'
  }

  private randomToken(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let token = ''
    for (let i = 0; i < 16; i++) {
      token += chars[Math.floor(Math.random() * chars.length)]
    }
    return token
  }
}
