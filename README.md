# Music Hunter 🎵

音乐猎手 — 粘贴分享链接，解析歌单，聚合高品质音源。

## 功能

- **歌单解析** — 支持网易云音乐、QQ音乐、酷狗、酷我的分享链接
- **跨平台搜索** — 自动从多个平台交叉搜索同一首歌的高品质版本
- **音质优先** — 按 无损(FLAC) > 高品(320k) > 标准(128k) 排序返回最佳音源
- **一键部署** — Docker 支持，适合低配服务器

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 + Vue Router + Pinia + Vite |
| 后端 | Fastify + TypeScript (ESM) |
| 部署 | Docker multi-stage build |

## 快速开始

### 开发模式

```bash
# 安装依赖
npm run install:all

# 同时启动前后端（前端 Vite dev server + 后端 tsx watch）
npm run dev
```

前端: http://localhost:5173  
后端 API: http://localhost:3721

### Docker 部署

```bash
docker compose up -d
```

服务运行在 http://localhost:3721（前后端一体）

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查，返回支持的平台列表 |
| POST | `/api/parse` | 解析分享链接，识别平台/类型/ID |
| POST | `/api/playlist` | 获取歌单详情（含歌曲列表） |
| GET | `/api/search?keyword=xxx` | 搜索歌曲 |
| POST | `/api/song/sources` | 聚合搜索歌曲的高品质音源 |

### 示例

```bash
# 解析网易云歌单链接
curl -X POST http://localhost:3721/api/parse \
  -H "Content-Type: application/json" \
  -d '{"url": "https://music.163.com/playlist?id=123456"}'

# 获取歌单详情
curl -X POST http://localhost:3721/api/playlist \
  -H "Content-Type: application/json" \
  -d '{"url": "https://music.163.com/playlist?id=123456"}'
```

## 项目结构

```
music-hunter/
├── server/                 # 后端
│   └── src/
│       ├── api/            # HTTP 路由
│       ├── platforms/      # 各平台解析器 (netease/qqmusic/kugou/kuwo)
│       ├── sources/        # 音源聚合器
│       ├── types/          # TypeScript 类型定义
│       └── utils/          # 工具函数 (HTTP/加密)
├── web/                    # 前端 (Vue 3 SPA)
│   └── src/
│       ├── api/            # API 调用封装
│       └── views/          # 页面组件
├── Dockerfile              # 多阶段构建
└── docker-compose.yml      # 一键部署
```

## 支持平台

| 平台 | 歌单 | 歌曲 | 搜索 | 音源获取 |
|---|:---:|:---:|:---:|:---:|
| 网易云音乐 | ✅ | ✅ | ✅ | ✅ |
| QQ音乐 | ✅ | ✅ | ✅ | ✅ |
| 酷狗音乐 | ✅ | ✅ | ✅ | ✅ |
| 酷我音乐 | ✅ | ✅ | ✅ | ✅ |

## License

MIT
