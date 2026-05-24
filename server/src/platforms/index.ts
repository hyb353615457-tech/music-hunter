/**
 * 平台解析器注册中心
 * 自动匹配URL到对应平台解析器
 */
import type { PlatformParser, ParseResult, Playlist } from '../types/index.js'
import { NeteaseParser } from './netease.js'
import { QQMusicParser } from './qqmusic.js'
import { KuwoParser } from './kuwo.js'
import { KugouParser } from './kugou.js'

class PlatformRegistry {
  private parsers: PlatformParser[] = []

  constructor() {
    this.parsers = [
      new NeteaseParser(),
      new QQMusicParser(),
      new KuwoParser(),
      new KugouParser(),
    ]
  }

  /** 根据URL自动匹配平台并解析 */
  async parseUrl(url: string): Promise<ParseResult> {
    const parser = this.findParser(url)
    if (!parser) {
      throw new Error(`不支持的链接格式: ${url}`)
    }
    return parser.parseShareUrl(url)
  }

  /** 获取歌单详情（自动路由到对应平台） */
  async getPlaylist(url: string): Promise<Playlist> {
    const parser = this.findParser(url)
    if (!parser) {
      throw new Error(`不支持的链接格式: ${url}`)
    }
    const result = await parser.parseShareUrl(url)
    if (result.type !== 'playlist') {
      throw new Error(`链接不是歌单类型: ${result.type}`)
    }
    return parser.getPlaylist(result.id)
  }

  /** 获取指定平台的解析器 */
  getParser(platform: string): PlatformParser | undefined {
    return this.parsers.find(p => p.platform === platform)
  }

  /** 查找匹配URL的解析器 */
  private findParser(url: string): PlatformParser | undefined {
    return this.parsers.find(p => p.match(url))
  }

  /** 获取所有已注册平台 */
  listPlatforms(): string[] {
    return this.parsers.map(p => p.platform)
  }
}

export const registry = new PlatformRegistry()
export { NeteaseParser, QQMusicParser, KuwoParser, KugouParser }
