# Multi-stage build: 前端构建 + 后端运行
FROM node:22-alpine AS web-builder
WORKDIR /app/web
COPY web/package.json web/package-lock.json* ./
RUN npm install
COPY web/ ./
RUN npm run build

FROM node:22-alpine AS server-builder
WORKDIR /app/server
COPY server/package.json server/package-lock.json* ./
RUN npm install
COPY server/ ./
RUN npm run build

# 生产镜像
FROM node:22-alpine
WORKDIR /app

# 只安装生产依赖
COPY server/package.json ./
RUN npm install --omit=dev && npm cache clean --force

# 复制构建产物
COPY --from=server-builder /app/server/dist ./dist
COPY --from=web-builder /app/web/dist ./web/dist

ENV NODE_ENV=production
ENV PORT=3721
EXPOSE 3721

CMD ["node", "dist/index.js"]
