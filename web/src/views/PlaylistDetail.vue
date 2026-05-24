<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getPlaylistById, getSongSources, type Playlist, type Song, type AudioSource } from '../api'

const route = useRoute()
const playlist = ref<Playlist | null>(null)
const loading = ref(true)
const error = ref('')
const songSources = ref<Map<string, AudioSource[]>>(new Map())
const loadingSongs = ref<Set<string>>(new Set())
const selectedQuality = ref('hq')

onMounted(async () => {
  const { platform, id } = route.params as { platform: string; id: string }
  try {
    playlist.value = await getPlaylistById(platform, id)
  } catch (err: any) {
    error.value = err.message
  } finally {
    loading.value = false
  }
})

async function fetchSource(song: Song) {
  if (loadingSongs.value.has(song.id)) return
  loadingSongs.value.add(song.id)

  try {
    const sources = await getSongSources(song, selectedQuality.value)
    songSources.value.set(song.id, sources)
  } catch {
    songSources.value.set(song.id, [])
  } finally {
    loadingSongs.value.delete(song.id)
  }
}

async function fetchAllSources() {
  if (!playlist.value) return
  for (const song of playlist.value.songs) {
    await fetchSource(song)
    // 间隔避免限流
    await new Promise(r => setTimeout(r, 500))
  }
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatSize(bytes?: number): string {
  if (!bytes) return ''
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

function qualityLabel(q: string): string {
  switch (q) {
    case 'lossless': return 'FLAC'
    case 'hq': return '320K'
    case 'standard': return '128K'
    default: return q
  }
}

function downloadSource(source: AudioSource, song: Song) {
  const a = document.createElement('a')
  a.href = source.url
  a.download = `${song.artists[0]} - ${song.name}.${source.format}`
  a.target = '_blank'
  a.click()
}
</script>

<template>
  <div class="detail">
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <template v-else-if="playlist">
      <!-- 歌单头部 -->
      <div class="playlist-header">
        <img v-if="playlist.cover" :src="playlist.cover" class="cover" alt="" />
        <div class="info">
          <h2>{{ playlist.name }}</h2>
          <p class="meta">
            {{ playlist.creator }} · {{ playlist.songCount }} 首 · {{ playlist.platform }}
          </p>
          <p v-if="playlist.description" class="desc">{{ playlist.description }}</p>

          <div class="actions">
            <select v-model="selectedQuality" class="quality-select">
              <option value="lossless">无损 FLAC</option>
              <option value="hq">高品质 320K</option>
              <option value="standard">标准 128K</option>
            </select>
            <button class="btn-primary" @click="fetchAllSources">
              一键获取全部音源
            </button>
          </div>
        </div>
      </div>

      <!-- 歌曲列表 -->
      <div class="song-table">
        <div class="table-header">
          <span class="col-idx">#</span>
          <span class="col-name">歌曲</span>
          <span class="col-album">专辑</span>
          <span class="col-duration">时长</span>
          <span class="col-action">音源</span>
        </div>

        <div v-for="(song, idx) in playlist.songs" :key="song.id" class="table-row">
          <span class="col-idx">{{ idx + 1 }}</span>
          <div class="col-name">
            <span class="name">{{ song.name }}</span>
            <span class="artist">{{ song.artists.join(' / ') }}</span>
          </div>
          <span class="col-album">{{ song.album }}</span>
          <span class="col-duration">{{ formatDuration(song.duration) }}</span>
          <div class="col-action">
            <button
              v-if="!songSources.has(song.id)"
              class="btn-sm"
              :disabled="loadingSongs.has(song.id)"
              @click="fetchSource(song)"
            >
              {{ loadingSongs.has(song.id) ? '...' : '搜索' }}
            </button>

            <!-- 音源结果 -->
            <div v-else class="sources">
              <template v-if="songSources.get(song.id)!.length > 0">
                <button
                  v-for="(source, si) in songSources.get(song.id)!"
                  :key="si"
                  class="source-btn"
                  :title="`${source.sourceName} ${formatSize(source.size)}`"
                  @click="downloadSource(source, song)"
                >
                  {{ qualityLabel(source.quality) }}
                  <small>{{ source.format }}</small>
                </button>
              </template>
              <span v-else class="no-source">无</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.detail {
  max-width: 1000px;
  margin: 0 auto;
}

.loading, .error {
  text-align: center;
  padding: 48px;
  color: var(--text-muted);
}

.error {
  color: #ef4444;
}

.playlist-header {
  display: flex;
  gap: 24px;
  margin-bottom: 32px;
  padding: 24px;
  background: var(--bg-card);
  border-radius: var(--radius);
}

.cover {
  width: 180px;
  height: 180px;
  border-radius: 8px;
  object-fit: cover;
}

.info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.info h2 {
  font-size: 1.5rem;
}

.meta {
  color: var(--text-muted);
}

.desc {
  color: var(--text-muted);
  font-size: 0.9rem;
  line-height: 1.5;
}

.actions {
  margin-top: auto;
  display: flex;
  gap: 12px;
  align-items: center;
}

.quality-select {
  padding: 8px 12px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text);
  font-size: 0.9rem;
}

.btn-primary {
  padding: 10px 20px;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary:hover {
  background: var(--primary-hover);
}

/* 表格 */
.song-table {
  background: var(--bg-card);
  border-radius: var(--radius);
  overflow: hidden;
}

.table-header, .table-row {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  gap: 16px;
}

.table-header {
  background: rgba(99, 102, 241, 0.08);
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.table-row {
  border-bottom: 1px solid var(--border);
  transition: background 0.15s;
}

.table-row:hover {
  background: rgba(99, 102, 241, 0.04);
}

.col-idx { width: 40px; text-align: center; color: var(--text-muted); font-size: 0.85rem; }
.col-name { flex: 1; min-width: 0; }
.col-album { width: 150px; font-size: 0.85rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.col-duration { width: 50px; text-align: right; font-size: 0.85rem; color: var(--text-muted); }
.col-action { width: 160px; display: flex; gap: 6px; flex-wrap: wrap; }

.col-name .name {
  display: block;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.col-name .artist {
  display: block;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.btn-sm {
  padding: 4px 12px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-sm:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
}

.btn-sm:disabled {
  opacity: 0.5;
}

.sources {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.source-btn {
  padding: 3px 8px;
  background: var(--success);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.75rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 3px;
  transition: opacity 0.2s;
}

.source-btn:hover {
  opacity: 0.85;
}

.source-btn small {
  opacity: 0.8;
  text-transform: uppercase;
}

.no-source {
  font-size: 0.8rem;
  color: var(--text-muted);
}

@media (max-width: 768px) {
  .playlist-header {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .col-album {
    display: none;
  }
  .actions {
    justify-content: center;
  }
}
</style>
