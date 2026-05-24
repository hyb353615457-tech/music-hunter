/**
 * 酷狗音乐平台解析器
 * 
 * API特点:
 * - 搜索: https://complexsearch.kugou.com/v2/search/song
 * - 歌单: https://www.kugou.com/yy/special/single/{id}.html (需要解析HTML)
 *         或 http://mobilecdnbj.kugou.com/api/v3/special/song (移动端API)
 * - 音频URL: https://wwwapi.kugou.com/yy/index.php?r=play/getdata
 * - 签名: MD5(参数拼接)
 */
import crypto from 'node:crypto'
import { createHttpClient, requestWithRetry } from '../utils/http.js'
import type { PlatformParser, ParseResult, Playlist, Song, AudioSource } from '../types/index.js'
import { Platform, Quality } from '../types/index.js'

export class KugouParser implements PlatformParser {
  platform = Platform.Kugou

  match(url: string): boolean {
    return /kugou\.com/.test(url)
  }

  async parseShareUrl(url: string): Promise<ParseResult> {
    // 酷狗歌单链接: https://www.kugou.com/yy/special/single/xxx.html
    // 或: https://www.kugou.com/share/zlist.html?id=xxx
    const specialMatch = url.match(/special\/single\/(\d+)/)
    const shareMatch = url.match(/[?&]id=(\d+)/)
    const songMatch = url.match(/song[/#](\w+)/)

    const id = specialMatch?.[1] || shareMatch?.[1]
    if (id) {
      return { type: 'playlist', platform: Platform.Kugou, id }
    }
    if (songMatch) {
      return { type: 'song', platform: Platform.Kugou, id: songMatch[1] }
    }

    throw new Error(`无法解析酷狗链接: ${url}`)
  }

  async getPlaylist(id: string): Promise<Playlist> {
    const client = createHttpClient()

    // 使用移动端API获取歌单歌曲列表
    const resp = await requestWithRetry(() =>
      client.get('http://mobilecdnbj.kugou.com/api/v3/special/song', {
        params: {
          specialid: id,
          area_code: 1,
          page: 1,
          pagesize: 1000,
          plat: 2,
          version: 8000,
        },
      })
    )

    const data = resp.data?.data
    if (!data) throw new Error('获取酷狗歌单失败')

    // 获取歌单基本信息
    const infoResp = await client.get('http://mobilecdnbj.kugou.com/api/v3/special/info', {
      params: { specialid: id },
    }).catch(() => null)

    const info = infoResp?.data?.data || {}
    const songs: Song[] = (data.info || []).map((item: any) => this.mapSong(item))

    return {
      id,
      name: info.specialname || `酷狗歌单${id}`,
      description: info.intro || '',
      cover: info.imgurl?.replace('{size}', '400') || '',
      creator: info.nickname || '',
      platform: Platform.Kugou,
      songs,
      songCount: data.total || songs.length,
    }
  }

  async search(keyword: string, page = 1): Promise<Song[]> {
    const client = createHttpClient()
    const timestamp = Date.now()

    // 酷狗搜索签名
    const signStr = `NVPh5oo715z5DIWAeQlhMDsWXXQV4hwtbitrate=0callback=callback123clienttime=${timestamp}clientver=2000dfid=-filter=10inputtype=0isdigi=0keyword=${keyword}mid=${timestamp}page=${page}pagesize=30platform=WebFilterprivilege_filter=0srcappid=2919tag=emuserid=-1uuid=${timestamp}NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt`
    const signature = crypto.createHash('md5').update(signStr).digest('hex').toUpperCase()

    const resp = await requestWithRetry(() =>
      client.get('https://complexsearch.kugou.com/v2/search/song', {
        params: {
          callback: 'callback123',
          srcappid: 2919,
          clientver: 2000,
          clienttime: timestamp,
          mid: timestamp,
          uuid: timestamp,
          dfid: '-',
          keyword,
          page,
          pagesize: 30,
          bitrate: 0,
          isfuzzy: 0,
          inputtype: 0,
          platform: 'WebFilter',
          userid: -1,
          iscorrection: 1,
          privilege_filter: 0,
          filter: 10,
          token: '',
          appid: 1014,
          signature,
        },
      })
    )

    // 去掉JSONP包装
    let data = resp.data
    if (typeof data === 'string') {
      const match = data.match(/callback123\((.*)\)/)
      if (match) data = JSON.parse(match[1])
    }

    const list = data?.data?.lists || []
    return list.map((item: any) => this.mapSearchResult(item))
  }

  async getSongUrl(song: Song, quality = Quality.HQ): Promise<AudioSource | null> {
    // 酷狗需要先获取歌曲hash对应的播放信息
    const client = createHttpClient({
      headers: {
        'Cookie': 'kg_mid=placeholder',
      },
    })

    const hash = song.platformId
    const albumId = (song as any).albumId || ''

    const resp = await requestWithRetry(() =>
      client.get('https://wwwapi.kugou.com/yy/index.php', {
        params: {
          r: 'play/getdata',
          hash,
          album_id: albumId,
          dfid: '0',
          mid: 'placeholder',
          platid: 4,
        },
      })
    )

    const data = resp.data?.data
    if (!data?.play_url && !data?.play_backup_url) return null

    return {
      url: data.play_url || data.play_backup_url,
      quality: data.bitrate >= 900 ? Quality.Lossless : data.bitrate >= 320 ? Quality.HQ : Quality.Standard,
      format: data.extName || 'mp3',
      size: data.fileSize,
      sourceName: '酷狗音乐',
      bitrate: data.bitrate || 128,
    }
  }

  // ---- 私有方法 ----

  private mapSong(item: any): Song {
    const hash = item.hash || item['320hash'] || item.sqhash || ''
    return {
      id: `kugou_${hash}`,
      name: item.filename?.split(' - ').pop() || item.songname || '',
      artists: item.filename?.split(' - ').shift()?.split('、') || [],
      album: item.album_name || item.remark || '',
      duration: item.duration || 0,
      platform: Platform.Kugou,
      platformId: hash,
      cover: item.album_img?.replace('{size}', '400') || '',
    }
  }

  private mapSearchResult(item: any): Song {
    return {
      id: `kugou_${item.FileHash}`,
      name: item.SongName?.replace(/<[^>]+>/g, '') || '',
      artists: (item.SingerName || '').split('、'),
      album: item.AlbumName || '',
      duration: item.Duration || 0,
      platform: Platform.Kugou,
      platformId: item.FileHash || item.HQFileHash || '',
      cover: '',
    }
  }
}
