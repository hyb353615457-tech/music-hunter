/**
 * HTTP API 路由定义
 * RESTful风格，所有响应统一格式
 */
import type { FastifyInstance } from 'fastify'
import { registry } from '../platforms/index.js'
import { aggregator } from '../sources/aggregator.js'
import { Quality } from '../types/index.js'
import type { ApiResponse, Playlist, Song, AudioSource } from '../types/index.js'

export async function registerRoutes(app: FastifyInstance) {

  /** 健康检查 */
  app.get('/api/health', async () => {
    return { code: 0, message: 'ok', data: { platforms: registry.listPlatforms() } }
  })

  /**
   * 解析分享链接
   * POST /api/parse
   * Body: { url: string }
   */
  app.post<{ Body: { url: string } }>('/api/parse', async (request, reply) => {
    const { url } = request.body
    if (!url) {
      return reply.status(400).send({ code: 400, message: '缺少url参数' })
    }

    try {
      const result = await registry.parseUrl(url)
      return { code: 0, message: 'ok', data: result } satisfies ApiResponse
    } catch (err: any) {
      return reply.status(400).send({ code: 400, message: err.message })
    }
  })

  /**
   * 获取歌单详情
   * POST /api/playlist
   * Body: { url: string } 或 { platform: string, id: string }
   */
  app.post<{ Body: { url?: string; platform?: string; id?: string } }>('/api/playlist', async (request, reply) => {
    const { url, platform, id } = request.body

    try {
      let playlist: Playlist

      if (url) {
        playlist = await registry.getPlaylist(url)
      } else if (platform && id) {
        const parser = registry.getParser(platform)
        if (!parser) {
          return reply.status(400).send({ code: 400, message: `不支持的平台: ${platform}` })
        }
        playlist = await parser.getPlaylist(id)
      } else {
        return reply.status(400).send({ code: 400, message: '需要提供url或platform+id' })
      }

      return { code: 0, message: 'ok', data: playlist } satisfies ApiResponse<Playlist>
    } catch (err: any) {
      return reply.status(500).send({ code: 500, message: err.message })
    }
  })

  /**
   * 搜索歌曲
   * GET /api/search?keyword=xxx&platform=netease&page=1
   */
  app.get<{ Querystring: { keyword: string; platform?: string; page?: string } }>('/api/search', async (request, reply) => {
    const { keyword, platform, page = '1' } = request.query
    if (!keyword) {
      return reply.status(400).send({ code: 400, message: '缺少keyword参数' })
    }

    try {
      if (platform) {
        const parser = registry.getParser(platform)
        if (!parser) {
          return reply.status(400).send({ code: 400, message: `不支持的平台: ${platform}` })
        }
        const songs = await parser.search(keyword, Number(page))
        return { code: 0, message: 'ok', data: songs } satisfies ApiResponse<Song[]>
      }

      // 不指定平台则搜索所有平台
      const allPlatforms = registry.listPlatforms()
      const searches = allPlatforms.map(p => {
        const parser = registry.getParser(p)!
        return parser.search(keyword, Number(page)).catch(() => [] as Song[])
      })
      const results = await Promise.all(searches)
      const songs = results.flat()

      return { code: 0, message: 'ok', data: songs } satisfies ApiResponse<Song[]>
    } catch (err: any) {
      return reply.status(500).send({ code: 500, message: err.message })
    }
  })

  /**
   * 获取歌曲音源（单曲）
   * POST /api/source
   * Body: { song: Song, quality?: 'lossless' | 'hq' | 'standard' }
   */
  app.post<{ Body: { song: Song; quality?: string } }>('/api/source', async (request, reply) => {
    const { song, quality = 'hq' } = request.body
    if (!song) {
      return reply.status(400).send({ code: 400, message: '缺少song参数' })
    }

    try {
      const q = quality as Quality
      const sources = await aggregator.searchSources(song, q)
      return { code: 0, message: 'ok', data: sources } satisfies ApiResponse<AudioSource[]>
    } catch (err: any) {
      return reply.status(500).send({ code: 500, message: err.message })
    }
  })

  /**
   * 批量获取歌单音源
   * POST /api/playlist/sources
   * Body: { url: string, quality?: string }
   * 
   * 返回SSE流式进度
   */
  app.post<{ Body: { url?: string; songs?: Song[]; quality?: string } }>('/api/playlist/sources', async (request, reply) => {
    const { url, songs: inputSongs, quality = 'hq' } = request.body

    try {
      let songs: Song[]

      if (url) {
        const playlist = await registry.getPlaylist(url)
        songs = playlist.songs
      } else if (inputSongs) {
        songs = inputSongs
      } else {
        return reply.status(400).send({ code: 400, message: '需要提供url或songs' })
      }

      const q = quality as Quality
      const results = await aggregator.searchPlaylistSources(songs, q, 3)

      // 转换Map为可序列化对象
      const data: Record<string, AudioSource[]> = {}
      for (const [songId, sources] of results) {
        data[songId] = sources
      }

      return { code: 0, message: 'ok', data: { total: songs.length, sources: data } }
    } catch (err: any) {
      return reply.status(500).send({ code: 500, message: err.message })
    }
  })

  /**
   * 设置平台Cookie（登录态）
   * POST /api/auth/cookie
   * Body: { platform: string, cookies: string, uin?: string }
   */
  app.post<{ Body: { platform: string; cookies: string; uin?: string } }>('/api/auth/cookie', async (request, reply) => {
    const { platform, cookies, uin } = request.body
    if (!platform || !cookies) {
      return reply.status(400).send({ code: 400, message: '缺少platform或cookies参数' })
    }

    const parser = registry.getParser(platform) as any
    if (!parser) {
      return reply.status(400).send({ code: 400, message: `不支持的平台: ${platform}` })
    }

    if (typeof parser.setCookies === 'function') {
      parser.setCookies(cookies, uin)
    }

    return { code: 0, message: 'ok', data: { platform, status: 'authenticated' } }
  })
}
