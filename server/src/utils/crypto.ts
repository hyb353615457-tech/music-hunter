/**
 * 网易云音乐加密工具
 * 参考: Binaryify/NeteaseCloudMusicApi, go-musicfox/netease-music
 */
import crypto from 'node:crypto'

// WeAPI 加密常量
const IV = Buffer.from('0102030405060708')
const PRESET_KEY = Buffer.from('0CoJUm6Qyw8W8jud')
const RSA_PUBLIC_KEY_MODULUS = '00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7'
const RSA_PUBLIC_KEY_EXPONENT = '010001'

// EAPI 加密常量
const EAPI_KEY = Buffer.from('e82ckenh8dichen8')

/** AES-128-CBC 加密 */
function aesEncrypt(data: Buffer, key: Buffer, iv: Buffer): Buffer {
  const cipher = crypto.createCipheriv('aes-128-cbc', key, iv)
  return Buffer.concat([cipher.update(data), cipher.final()])
}

/** AES-128-ECB 加密 */
function aesEcbEncrypt(data: Buffer, key: Buffer): Buffer {
  const cipher = crypto.createCipheriv('aes-128-ecb', key, null)
  return Buffer.concat([cipher.update(data), cipher.final()])
}

/** AES-128-ECB 解密 */
export function aesEcbDecrypt(data: Buffer, key: Buffer): Buffer {
  const decipher = crypto.createDecipheriv('aes-128-ecb', key, null)
  return Buffer.concat([decipher.update(data), decipher.final()])
}

/** 生成随机16字节密钥 */
function generateSecretKey(): Buffer {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let key = ''
  for (let i = 0; i < 16; i++) {
    key += chars[Math.floor(Math.random() * chars.length)]
  }
  return Buffer.from(key)
}

/** RSA 加密（无填充） */
function rsaEncrypt(data: Buffer): string {
  // 反转数据（NetEase特有）
  const reversed = Buffer.from(data).reverse()
  const hex = reversed.toString('hex')
  // 大数幂模运算
  const bigData = BigInt('0x' + hex)
  const bigMod = BigInt('0x' + RSA_PUBLIC_KEY_MODULUS)
  const bigExp = BigInt('0x' + RSA_PUBLIC_KEY_EXPONENT)
  const result = modPow(bigData, bigExp, bigMod)
  return result.toString(16).padStart(256, '0')
}

/** 大数幂模运算 */
function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n
  base = base % mod
  while (exp > 0n) {
    if (exp % 2n === 1n) {
      result = (result * base) % mod
    }
    exp = exp / 2n
    base = (base * base) % mod
  }
  return result
}

/**
 * WeAPI 加密
 * 用于网易云Web端API请求
 */
export function weApiEncrypt(data: object): { params: string; encSecKey: string } {
  const text = JSON.stringify(data)
  const secretKey = generateSecretKey()

  // 第一次AES加密：用预设密钥
  const firstEncrypt = aesEncrypt(Buffer.from(text), PRESET_KEY, IV)
  // 第二次AES加密：用随机密钥
  const params = aesEncrypt(
    Buffer.from(firstEncrypt.toString('base64')),
    secretKey,
    IV
  ).toString('base64')

  // RSA加密随机密钥
  const encSecKey = rsaEncrypt(secretKey)

  return { params, encSecKey }
}

/**
 * EAPI 加密
 * 用于网易云客户端API请求
 */
export function eApiEncrypt(url: string, data: object): { params: string } {
  const text = JSON.stringify(data)
  const message = `nobody${url}use${text}md5forencrypt`
  const digest = crypto.createHash('md5').update(message).digest('hex')
  const payload = `${url}-36cd479b6b5-${text}-36cd479b6b5-${digest}`
  const encrypted = aesEcbEncrypt(Buffer.from(payload), EAPI_KEY)
  return { params: encrypted.toString('hex').toUpperCase() }
}

/**
 * EAPI 解密响应
 */
export function eApiDecrypt(data: string): string {
  const buf = Buffer.from(data, 'hex')
  return aesEcbDecrypt(buf, EAPI_KEY).toString()
}
