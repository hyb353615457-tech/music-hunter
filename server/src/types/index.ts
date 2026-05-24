/** 音乐平台枚举 */
export enum Platform {
  Netease = 'netease',
  QQMusic = 'qqmusic',
  Kugou = 'kugou',
  Kuwo = 'kuwo',
}

/** 音质等级 */
export enum Quality {
  Lossless = 'lossless',   // FLAC / WAV
  HQ = 'hq',              // 320kbps
  Standard = 'standard',   // 128kbps
}

/** 歌曲信息 */
export interface Song {
  id: string
  name: string
  artists: string[]
  album: string
  duration: number          // 秒
  platform: Platform
  platformId: string        // 平台原始ID
  cover?: string
}

/** 歌单信息 */
export interface Playlist {
  id: string
  name: string
  description?: string
  cover?: string
  creator?: string
  platform: Platform
  songs: Song[]
  songCount: number
}

/** 音源搜索结果 */
export interface AudioSource {
  url: string
  quality: Quality
  format: string            // flac, mp3, m4a, etc.
  size?: number             // bytes
  sourceName: string        // 来源名称
  bitrate?: number          // kbps
  expireAt?: number         // URL过期时间戳
}

/** 分享链接解析结果 */
export interface ParseResult {
  type: 'playlist' | 'song' | 'album'
  platform: Platform
  id: string
  data?: Playlist | Song
}

/** 平台解析器接口 */
export interface PlatformParser {
  platform: Platform
  /** 判断URL是否属于该平台 */
  match(url: string): boolean
  /** 解析分享链接，提取歌单/歌曲ID */
  parseShareUrl(url: string): Promise<ParseResult>
  /** 获取歌单详情 */
  getPlaylist(id: string): Promise<Playlist>
  /** 搜索歌曲 */
  search(keyword: string, page?: number): Promise<Song[]>
  /** 获取歌曲播放URL（平台自身源） */
  getSongUrl(song: Song, quality?: Quality): Promise<AudioSource | null>
}

/** 音源搜索器接口 */
export interface SourceSearcher {
  name: string
  /** 根据歌曲信息搜索高品质音源 */
  search(song: Song, quality?: Quality): Promise<AudioSource[]>
}

/** 用户登录凭证 */
export interface Credential {
  platform: Platform
  cookies?: string
  token?: string
  userId?: string
  expireAt?: number
}

/** API响应格式 */
export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data?: T
}
