/**
 * HTTP 请求工具
 * 统一管理请求头、Cookie、重试逻辑
 */
import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'

/** 创建带默认配置的HTTP客户端 */
export function createHttpClient(baseConfig?: AxiosRequestConfig): AxiosInstance {
  const client = axios.create({
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
    ...baseConfig,
  })

  // 响应拦截器：统一错误处理
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      const status = error.response?.status
      const url = error.config?.url
      console.error(`[HTTP] ${status || 'NETWORK_ERROR'} ${url}`)
      throw error
    }
  )

  return client
}

/** 网易云音乐专用客户端 */
export function createNeteaseClient(cookies?: string): AxiosInstance {
  return createHttpClient({
    baseURL: 'https://music.163.com',
    headers: {
      'Referer': 'https://music.163.com',
      'Origin': 'https://music.163.com',
      ...(cookies ? { 'Cookie': cookies } : {}),
    },
  })
}

/** QQ音乐专用客户端 */
export function createQQMusicClient(cookies?: string): AxiosInstance {
  return createHttpClient({
    baseURL: 'https://u.y.qq.com',
    headers: {
      'Referer': 'https://y.qq.com',
      'Origin': 'https://y.qq.com',
      ...(cookies ? { 'Cookie': cookies } : {}),
    },
  })
}

/** 酷我音乐专用客户端 */
export function createKuwoClient(): AxiosInstance {
  return createHttpClient({
    baseURL: 'https://www.kuwo.cn',
    headers: {
      'Referer': 'https://www.kuwo.cn/',
      'csrf': '', // 需要动态获取
    },
  })
}

/** 酷狗音乐专用客户端 */
export function createKugouClient(): AxiosInstance {
  return createHttpClient({
    baseURL: 'https://www.kugou.com',
    headers: {
      'Referer': 'https://www.kugou.com/',
    },
  })
}

/** 带重试的请求 */
export async function requestWithRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (err) {
      if (i === retries - 1) throw err
      await new Promise(r => setTimeout(r, delay * (i + 1)))
    }
  }
  throw new Error('Unreachable')
}
