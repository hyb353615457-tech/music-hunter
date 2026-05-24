<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { parseUrl, getPlaylist, type Playlist } from '../api'

const router = useRouter()
const shareUrl = ref('')
const loading = ref(false)
const error = ref('')
const playlist = ref<Playlist | null>(null)

async function handleParse() {
  const url = shareUrl.value.trim()
  if (!url) return

  loading.value = true
  error.value = ''
  playlist.value = null

  try {
    const result = await parseUrl(url)

    if (result.type === 'playlist') {
      // 获取歌单详情
      const pl = await getPlaylist(url)
      playlist.value = pl
    } else {
      error.value = `解析成功: ${result.type} (${result.platform}) ID: ${result.id}`
    }
  } catch (err: any) {
    error.value = err.message || '解析失败'
  } finally {
    loading.value = false
  }
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function viewPlaylist() {
  if (playlist.value) {
    router.push(`/playlist/${playlist.value.platform}/${playlist.value.id}`)
  }
}
</script>

<template>
  <div class="home">
    <!-- Hero区域 -->
    <section class="hero">
      <h2 class="hero-title">粘贴分享链接，获取高品质音源</h2>
      <p class="hero-desc">支持网易云音乐、QQ音乐、酷狗、酷我的歌单/歌曲分享链接</p>

      <div class="search-box">
        <input
          v-model="shareUrl"
          type="text"
          class="search-input"
          placeholder="粘贴音乐平台分享链接... 例如: https://music.163.com/playlist?id=123456"
          @keyup.enter="handleParse"
        />
        <button class="search-btn" :disabled="loading" @click="handleParse">
          {{ loading ? '解析中...' : '解析' }}
        </button>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
    </section>

    <!-- 歌单结果 -->
    <section v-if="playlist" class="result">
      <div class="playlist-header">
        <img v-if="playlist.cover" :src="playlist.cover" class="playlist-cover" alt="" />
        <div class="playlist-info">
          <h3 class="playlist-name">{{ playlist.name }}</h3>
          <p class="playlist-meta">
            <span v-if="playlist.creator">{{ playlist.creator }}</span>
            <span>{{ playlist.songCount }} 首歌曲</span>
            <span class="platform-badge">{{ playlist.platform }}</span>
          </p>
          <p v-if="playlist.description" class="playlist-desc">{{ playlist.description }}</p>
          <button class="btn-primary" @click="viewPlaylist">查看详情 & 获取音源</button>
        </div>
      </div>

      <!-- 歌曲列表预览 -->
      <div class="song-list">
        <div v-for="(song, idx) in playlist.songs.slice(0, 20)" :key="song.id" class="song-item">
          <span class="song-idx">{{ idx + 1 }}</span>
          <div class="song-info">
            <span class="song-name">{{ song.name }}</span>
            <span class="song-artist">{{ song.artists.join(' / ') }}</span>
          </div>
          <span class="song-album">{{ song.album }}</span>
          <span class="song-duration">{{ formatDuration(song.duration) }}</span>
        </div>
        <p v-if="playlist.songs.length > 20" class="more-hint">
          还有 {{ playlist.songs.length - 20 }} 首歌曲...
        </p>
      </div>
    </section>

    <!-- 使用说明 -->
    <section v-if="!playlist" class="guide">
      <h3 class="guide-title">使用方法</h3>
      <div class="guide-steps">
        <div class="step">
          <div class="step-num">1</div>
          <div class="step-content">
            <h4>复制分享链接</h4>
            <p>在音乐App中找到歌单，点击分享，复制链接</p>
          </div>
        </div>
        <div class="step">
          <div class="step-num">2</div>
          <div class="step-content">
            <h4>粘贴并解析</h4>
            <p>将链接粘贴到上方输入框，点击解析</p>
          </div>
        </div>
        <div class="step">
          <div class="step-num">3</div>
          <div class="step-content">
            <h4>获取高品质音源</h4>
            <p>系统自动从多个平台搜索最高品质的音频文件</p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.home {
  max-width: 900px;
  margin: 0 auto;
}

.hero {
  text-align: center;
  padding: 48px 0;
}

.hero-title {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 12px;
  background: linear-gradient(135deg, var(--primary), #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-desc {
  color: var(--text-muted);
  margin-bottom: 32px;
}

.search-box {
  display: flex;
  gap: 12px;
  max-width: 700px;
  margin: 0 auto;
}

.search-input {
  flex: 1;
  padding: 14px 20px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 1rem;
  outline: none;
  transition: border-color 0.2s;
}

.search-input:focus {
  border-color: var(--primary);
}

.search-btn {
  padding: 14px 28px;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: var(--radius);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  white-space: nowrap;
}

.search-btn:hover:not(:disabled) {
  background: var(--primary-hover);
}

.search-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  color: #ef4444;
  margin-top: 16px;
}

/* 歌单结果 */
.result {
  margin-top: 32px;
}

.playlist-header {
  display: flex;
  gap: 24px;
  padding: 24px;
  background: var(--bg-card);
  border-radius: var(--radius);
  margin-bottom: 24px;
}

.playlist-cover {
  width: 160px;
  height: 160px;
  border-radius: 8px;
  object-fit: cover;
}

.playlist-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.playlist-name {
  font-size: 1.4rem;
  font-weight: 700;
}

.playlist-meta {
  display: flex;
  gap: 12px;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.platform-badge {
  background: var(--primary);
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
}

.playlist-desc {
  color: var(--text-muted);
  font-size: 0.9rem;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.btn-primary {
  margin-top: auto;
  align-self: flex-start;
  padding: 10px 20px;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary:hover {
  background: var(--primary-hover);
}

/* 歌曲列表 */
.song-list {
  background: var(--bg-card);
  border-radius: var(--radius);
  overflow: hidden;
}

.song-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border);
  transition: background 0.15s;
}

.song-item:hover {
  background: rgba(99, 102, 241, 0.05);
}

.song-item:last-child {
  border-bottom: none;
}

.song-idx {
  width: 32px;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.song-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.song-name {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-artist {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.song-album {
  width: 150px;
  font-size: 0.85rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-duration {
  width: 50px;
  text-align: right;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.more-hint {
  text-align: center;
  padding: 16px;
  color: var(--text-muted);
  font-size: 0.9rem;
}

/* 使用说明 */
.guide {
  margin-top: 48px;
}

.guide-title {
  font-size: 1.2rem;
  margin-bottom: 24px;
  text-align: center;
}

.guide-steps {
  display: flex;
  gap: 24px;
}

.step {
  flex: 1;
  display: flex;
  gap: 16px;
  padding: 20px;
  background: var(--bg-card);
  border-radius: var(--radius);
}

.step-num {
  width: 36px;
  height: 36px;
  background: var(--primary);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  flex-shrink: 0;
}

.step-content h4 {
  margin-bottom: 4px;
}

.step-content p {
  font-size: 0.85rem;
  color: var(--text-muted);
  line-height: 1.4;
}

@media (max-width: 768px) {
  .guide-steps {
    flex-direction: column;
  }
  .playlist-header {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .search-box {
    flex-direction: column;
  }
  .song-album {
    display: none;
  }
}
</style>
