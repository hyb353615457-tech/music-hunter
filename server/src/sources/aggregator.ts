/**
 * 音源搜索聚合器
 * 
 * 策略: 多平台交叉搜索
 * 1. 优先从其他平台获取同一首歌的高品质版本
 * 2. 搜索公开音源（磁力、网盘等）
 * 3. 按品质排序返回最佳结果
 */
import type { Song, AudioSource, SourceSearcher, PlatformParser } from '../types/index.js'
import { Quality, Platform } from '../types/index.js'
import { registry } from '../platforms/index.js'

/** 跨平台音源搜索器 */
class CrossPlatformSearcher implements SourceSearcher {
  name = '跨平台搜索'

  async search(song: Song, quality = Quality.HQ): Promise<AudioSource[]> {
    const results: AudioSource[] = []
    const keyword = `${song.artists[0] || ''} ${song.name}`.trim()

    // 从所有非原始平台搜索
    const platforms = registry.listPlatforms().filter(p => p !== song.platform)

    const searches = platforms.map(async (platform) => {
      try {
        const parser = registry.getParser(platform) as PlatformParser
        const found = await parser.search(keyword, 1)

        // 模糊匹配：找到最接近的歌曲
        const matched = this.findBestMatch(song, found)
        if (!matched) return null

        const source = await parser.getSongUrl(matched, quality)
        return source
      } catch {
        return null
      }
    })

    const searchResults = await Promise.allSettled(searches)
    for (const result of searchResults) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value)
      }
    }

    return results
  }

  /** 模糊匹配歌曲 */
  private findBestMatch(target: Song, candidates: Song[]): Song | null {
    if (candidates.length === 0) return null

    let bestScore = 0
    let bestMatch: Song | null = null

    for (const candidate of candidates) {
      let score = 0

      // 歌名相似度
      if (this.normalize(candidate.name) === this.normalize(target.name)) {
        score += 50
      } else if (this.normalize(candidate.name).includes(this.normalize(target.name))) {
        score += 30
      }

      // 歌手匹配
      const targetArtists = target.artists.map(a => this.normalize(a))
      const candidateArtists = candidate.artists.map(a => this.normalize(a))
      const artistOverlap = targetArtists.filter(a => candidateArtists.some(ca => ca.includes(a) || a.includes(ca)))
      score += artistOverlap.length * 20

      // 时长接近（±5秒）
      if (Math.abs(candidate.duration - target.duration) <= 5) {
        score += 15
      }

      if (score > bestScore) {
        bestScore = score
        bestMatch = candidate
      }
    }

    // 最低匹配阈值
    return bestScore >= 50 ? bestMatch : null
  }

  private normalize(str: string): string {
    return str.toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[（(][^）)]*[）)]/g, '') // 去掉括号内容
      .replace(/[\-_·]/g, '')
  }
}

/** 音源聚合管理器 */
export class SourceAggregator {
  private searchers: SourceSearcher[] = []

  constructor() {
    this.searchers = [
      new CrossPlatformSearcher(),
    ]
  }

  /** 注册额外的搜索器 */
  addSearcher(searcher: SourceSearcher) {
    this.searchers.push(searcher)
  }

  /**
   * 搜索歌曲的所有可用音源
   * 返回按品质降序排列的结果
   */
  async searchSources(song: Song, quality = Quality.HQ): Promise<AudioSource[]> {
    const allResults: AudioSource[] = []

    // 并发搜索所有源
    const searches = this.searchers.map(searcher =>
      searcher.search(song, quality).catch(() => [] as AudioSource[])
    )

    const results = await Promise.all(searches)
    for (const sources of results) {
      allResults.push(...sources)
    }

    // 按品质排序: Lossless > HQ > Standard
    return allResults.sort((a, b) => {
      const qualityOrder = { [Quality.Lossless]: 3, [Quality.HQ]: 2, [Quality.Standard]: 1 }
      return (qualityOrder[b.quality] || 0) - (qualityOrder[a.quality] || 0)
    })
  }

  /**
   * 批量搜索歌单中所有歌曲的音源
   */
  async searchPlaylistSources(
    songs: Song[],
    quality = Quality.HQ,
    concurrency = 3,
    onProgress?: (completed: number, total: number, song: Song) => void
  ): Promise<Map<string, AudioSource[]>> {
    const results = new Map<string, AudioSource[]>()

    // 分批并发处理，避免请求过快被封
    for (let i = 0; i < songs.length; i += concurrency) {
      const batch = songs.slice(i, i + concurrency)
      const batchResults = await Promise.all(
        batch.map(async (song) => {
          const sources = await this.searchSources(song, quality)
          onProgress?.(i + batch.indexOf(song) + 1, songs.length, song)
          return { songId: song.id, sources }
        })
      )

      for (const { songId, sources } of batchResults) {
        results.set(songId, sources)
      }

      // 批次间延迟，避免触发限流
      if (i + concurrency < songs.length) {
        await new Promise(r => setTimeout(r, 1000))
      }
    }

    return results
  }
}

export const aggregator = new SourceAggregator()
