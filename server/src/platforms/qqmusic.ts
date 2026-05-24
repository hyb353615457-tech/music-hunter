/**
 * QQ音乐平台解析器
 * 
 * API逆向参考:
 * - 统一网关: POST https://u.y.qq.com/cgi-bin/musicu.fcg
 * - 签名请求: POST https://u.y.qq.com/cgi-bin/musics.fcg?sign={sign}
 * - 分享链接: https://y.qq.com/n/ryqq/playlist/xxx 或 https://i.y.qq.com/n2/m/share/details/taoge.html?id=xxx
 */
import crypto from 'node:crypto'
import { createQQMusicClient, requestWithRetry } from '../utils/http.js'
import type { PlatformParser, ParseResult, Playlist, Song, AudioSource } from '../types/index.js'
import { Platform, Quality } from '../types/index.js'

export class QQMusicParser implements PlatformParser {
  platform = Platform.QQMusic
  private cookies: string
  private uin: string // QQ号

  constructor(cookies = '', uin = '0') {
    this.cookies = cookies
    this.uin = uin
  }

  match(url: string): boolean {
    return /y\.qq\.com|qq\.com.*music|c\.y\.qq\.com/.test(url)
  }

  async parseShareUrl(url: string): Promise<ParseResult> {
    // 处理各种QQ音乐链接格式
    const finalUrl = await this.resolveUrl(url)

    const playlistMatch = finalUrl.match(/(?:taoge|playlist)[./].*?(?:id=|\/)?(\d+)/)
    const songMatch = finalUrl.match(/(?:song|songDetail)[./].*?(?:id=|\/)?(\w+)/)
    const albumMatch = finalUrl.match(/(?:album)[./].*?(?:id=|\/)?(\w+)/)

    if (playlistMatch) {
      return { type: 'playlist', platform: Platform.QQMusic, id: playlistMatch[1] }
    }
    if (songMatch) {
      return { type: 'song', platform: Platform.QQMusic, id: songMatch[1] }
    }
    if (albumMatch) {
      return { type: 'album', platform: Platform.QQMusic, id: albumMatch[1] }
    }

    throw new Error(`无法解析QQ音乐链接: ${url}`)
  }

  async getPlaylist(id: string): Promise<Playlist> {
    const client = createQQMusicClient(this.cookies)

    // QQ音乐统一网关请求
    const reqData = {
      req_0: {
        module: 'srf_diss_info.DissInfoServer',
        method: 'CgiGetDiss',
        param: {
          disstid: Number(id),
          onlysonglist: 0,
          song_begin: 0,
          song_num: 1000,
        },
      },
      comm: {
        uin: this.uin,
        format: 'json',
        ct: 19,
        cv: 0,
      },
    }

    const resp = await requestWithRetry(() =>
      client.post('/cgi-bin/musicu.fcg', reqData)
    )

    const result = resp.data?.req_0?.data
    if (!result) {
      throw new Error('获取QQ音乐歌单失败')
    }

    const dirinfo = result.dirinfo
    const songs: Song[] = (result.songlist || []).map((item: any) => this.mapSong(item))

    return {
      id,
      name: dirinfo?.title || '',
      description: dirinfo?.desc || '',
      cover: dirinfo?.picurl || '',
      creator: dirinfo?.nick || '',
      platform: Platform.QQMusic,
      songs,
      songCount: dirinfo?.songnum || songs.length,
    }
  }

  async search(keyword: string, page = 1): Promise<Song[]> {
    const client = createQQMusicClient(this.cookies)

    const reqData = {
      req_0: {
        module: 'music.search.SearchCgiService',
        method: 'DoSearchForQQMusicDesktop',
        param: {
          query: keyword,
          page_num: page,
          num_per_page: 30,
          search_type: 0,
        },
      },
      comm: {
        uin: this.uin,
        format: 'json',
        ct: 19,
        cv: 0,
      },
    }

    const resp = await requestWithRetry(() =>
      client.post('/cgi-bin/musicu.fcg', reqData)
    )

    const songs = resp.data?.req_0?.data?.body?.song?.list || []
    return songs.map((item: any) => this.mapSong(item))
  }

  async getSongUrl(song: Song, quality = Quality.HQ): Promise<AudioSource | null> {
    const client = createQQMusicClient(this.cookies)
    const { prefix, suffix } = this.getQualityParams(quality)
    const filename = `${prefix}${song.platformId}${suffix}`

    const reqData = {
      req_0: {
        module: 'vkey.GetVkeyServer',
        method: 'CgiGetVkey',
        param: {
          filename: [filename],
          guid: this.generateGuid(),
          songmid: [song.platformId],
          songtype: [0],
          uin: this.uin,
          loginflag: 1,
          platform: '20',
        },
      },
      comm: {
        uin: this.uin,
        format: 'json',
        ct: 19,
        cv: 0,
      },
    }

    const resp = await requestWithRetry(() =>
      client.post('/cgi-bin/musicu.fcg', reqData)
    )

    const data = resp.data?.req_0?.data
    const purl = data?.midurlinfo?.[0]?.purl
    if (!purl) return null

    const sip = data?.sip?.[0] || 'https://dl.stream.qqmusic.qq.com/'
    return {
      url: sip + purl,
      quality,
      format: suffix.replace('.', ''),
      sourceName: 'QQ音乐',
      bitrate: quality === Quality.Lossless ? 900 : quality === Quality.HQ ? 320 : 128,
    }
  }

  setCookies(cookies: string, uin?: string) {
    this.cookies = cookies
    if (uin) this.uin = uin
  }

  // ---- 私有方法 ----

  private async resolveUrl(url: string): Promise<string> {
    // QQ音乐短链接处理
    if (/c\.y\.qq\.com/.test(url)) {
      try {
        const resp = await createQQMusicClient().get(url, {
          maxRedirects: 5,
        })
        return resp.request?.res?.responseUrl || url
      } catch {
        return url
      }
    }
    return url
  }

  private mapSong(item: any): Song {
    const mid = item.mid || item.songmid
    return {
      id: `qqmusic_${mid}`,
      name: item.name || item.songname || '',
      artists: (item.singer || []).map((s: any) => s.name || s.title),
      album: item.album?.name || item.albumname || '',
      duration: item.interval || 0,
      platform: Platform.QQMusic,
      platformId: mid,
      cover: item.album?.mid
        ? `https://y.qq.com/music/photo_new/T002R300x300M000${item.album.mid}.jpg`
        : undefined,
    }
  }

  private getQualityParams(quality: Quality): { prefix: string; suffix: string } {
    switch (quality) {
      case Quality.Lossless:
        return { prefix: 'F000', suffix: '.flac' }
      case Quality.HQ:
        return { prefix: 'M800', suffix: '.mp3' }
      case Quality.Standard:
      default:
        return { prefix: 'M500', suffix: '.mp3' }
    }
  }

  private generateGuid(): string {
    return Math.floor(Math.random() * 10000000000).toString()
  }
}
