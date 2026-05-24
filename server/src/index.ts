/**
 * Music Hunter - 音乐猎手
 * 从各大音乐平台分享链接获取歌单，自动搜索高品质音源
 */
import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerRoutes } from './api/routes.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function main() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: { colorize: true },
      },
    },
  })

  // CORS - 允许前端跨域
  await app.register(cors, {
    origin: true,
    credentials: true,
  })

  // 静态文件 - 生产环境serve前端构建产物
  const webDist = path.resolve(__dirname, '../../web/dist')
  try {
    await app.register(fastifyStatic, {
      root: webDist,
      prefix: '/',
      decorateReply: false,
    })
  } catch {
    // web/dist 不存在时忽略（开发模式）
  }

  // 注册API路由
  await registerRoutes(app)

  // SPA fallback - 非API路由返回index.html
  app.setNotFoundHandler(async (request, reply) => {
    if (!request.url.startsWith('/api/')) {
      return reply.sendFile('index.html')
    }
    return reply.status(404).send({ code: 404, message: 'Not Found' })
  })

  // 启动服务
  const host = process.env.HOST || '0.0.0.0'
  const port = Number(process.env.PORT) || 3721

  try {
    await app.listen({ host, port })
    console.log(`\n  🎵 Music Hunter 已启动`)
    console.log(`  📡 API: http://localhost:${port}/api/health`)
    console.log(`  🌐 Web: http://localhost:${port}\n`)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

main()
