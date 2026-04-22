<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, Search } from '@element-plus/icons-vue'
import {
  reqGetMusicHomeInfo,
  reqSearchSongByKeywords,
  reqWySearch
} from '@renderer/api/music'
import { FIXED_USER_ID } from '@renderer/constants/user'

/** 与 web_f MusicHome / search 页返回结构对齐，字段保持宽松 */
interface HomePayload {
  recommendList?: SongItem[]
  hotSingerList?: SingerItem[]
  rankList?: SongItem[]
}

interface SongItem {
  id?: string | number
  name?: string
  artist?: string
  cover?: string
  [key: string]: unknown
}

interface SingerItem {
  id?: string | number
  name?: string
  singerImg?: string
  [key: string]: unknown
}

const loading = ref(false)
const recommendList = ref<SongItem[]>([])
const hotSingerList = ref<SingerItem[]>([])
const rankList = ref<SongItem[]>([])

const kw = ref('')
const searchLoading = ref(false)
const searchRows = ref<SongItem[]>([])

async function loadHome() {
  loading.value = true
  try {
    const res = (await reqGetMusicHomeInfo({
      id: FIXED_USER_ID
    })) as { status?: boolean; data?: HomePayload }
    if (res?.status && res.data) {
      recommendList.value = res.data.recommendList ?? []
      hotSingerList.value = res.data.hotSingerList ?? []
      rankList.value = res.data.rankList ?? []
    } else {
      recommendList.value = []
      hotSingerList.value = []
      rankList.value = []
      ElMessage.warning('首页数据为空或 status 为 false')
    }
  } catch (e) {
    ElMessage.error(
      e instanceof Error ? e.message : '请求失败：请确认后端已启动（默认 localhost:8082），开发环境走 Vite 代理 /api'
    )
  } finally {
    loading.value = false
  }
}

async function onSearch() {
  const q = kw.value.trim()
  if (!q) {
    ElMessage.info('请输入关键词')
    return
  }
  searchLoading.value = true
  try {
    const res = (await reqSearchSongByKeywords({ keywords: q, userId: FIXED_USER_ID })) as {
      status?: boolean
      data?: SongItem[] | { list?: SongItem[] }
    }
    if (res?.status && res.data) {
      const d = res.data
      searchRows.value = Array.isArray(d) ? d : (d as { list?: SongItem[] }).list ?? []
    } else {
      searchRows.value = []
    }
    if (!searchRows.value.length) {
      ElMessage.info('无搜索结果')
    }
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '搜索失败')
  } finally {
    searchLoading.value = false
  }
}

async function onWySearch() {
  const q = kw.value.trim()
  if (!q) {
    ElMessage.info('请输入关键词')
    return
  }
  searchLoading.value = true
  try {
    const res = (await reqWySearch({ keywords: q, userId: FIXED_USER_ID })) as { status?: boolean; data?: unknown }
    if (res?.status) {
      ElMessage.success('网易搜索已返回（数据结构以后端为准）')
      console.debug('[reqWySearch]', res.data)
    } else {
      ElMessage.warning('网易搜索无有效数据')
    }
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '网易搜索失败')
  } finally {
    searchLoading.value = false
  }
}

onMounted(() => {
  void loadHome()
})

defineExpose({ reload: loadHome })
</script>

<template>
  <div class="online-panel" v-loading="loading">
    <div class="online-toolbar">
      <el-button type="primary" :icon="Refresh" @click="loadHome">刷新首页</el-button>
      <el-input
        v-model="kw"
        clearable
        placeholder="关键字搜索歌曲（searchSong）"
        class="online-search"
        @keyup.enter="onSearch"
      />
      <el-button type="primary" :icon="Search" :loading="searchLoading" @click="onSearch">
        搜索
      </el-button>
      <el-button :loading="searchLoading" @click="onWySearch">网易搜索</el-button>
    </div>

    <div class="online-block">
      <div class="online-title">今日推荐</div>
      <el-empty v-if="!recommendList.length" description="暂无推荐" />
      <el-row v-else :gutter="12">
        <el-col v-for="item in recommendList" :key="String(item.id)" :span="6" :xs="12">
          <el-card shadow="hover" class="online-card">
            <img v-if="item.cover" class="online-cover" :src="String(item.cover)" alt="" />
            <div class="online-name">{{ item.name }}</div>
            <div class="online-sub">{{ item.artist }}</div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <div class="online-block">
      <div class="online-title">热门歌手</div>
      <el-empty v-if="!hotSingerList.length" description="暂无歌手" />
      <el-row v-else :gutter="12">
        <el-col v-for="s in hotSingerList" :key="String(s.id)" :span="4" :xs="8">
          <div class="online-singer">
            <img v-if="s.singerImg" class="online-simg" :src="String(s.singerImg)" alt="" />
            <div class="online-sname">{{ s.name }}</div>
          </div>
        </el-col>
      </el-row>
    </div>

    <div class="online-block">
      <div class="online-title">全站热榜</div>
      <el-empty v-if="!rankList.length" description="暂无榜单" />
      <el-table v-else :data="rankList" size="small" max-height="240">
        <el-table-column prop="name" label="歌曲" min-width="140" />
        <el-table-column prop="artist" label="歌手" width="120" />
      </el-table>
    </div>

    <div v-if="searchRows.length" class="online-block">
      <div class="online-title">搜索结果</div>
      <el-table :data="searchRows" size="small" max-height="280">
        <el-table-column prop="name" label="歌曲" min-width="140" />
        <el-table-column prop="artist" label="歌手" width="120" />
      </el-table>
    </div>
  </div>
</template>

<style scoped>
.online-panel {
  padding: 8px 12px;
  overflow: auto;
  height: 100%;
}
.online-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-bottom: 16px;
}
.online-search {
  flex: 1;
  min-width: 200px;
  max-width: 420px;
}
.online-block {
  margin-bottom: 20px;
}
.online-title {
  font-weight: 600;
  margin-bottom: 10px;
}
.online-card {
  margin-bottom: 12px;
}
.online-cover {
  width: 100%;
  height: 100px;
  object-fit: cover;
  border-radius: 6px;
}
.online-name {
  margin-top: 6px;
  font-size: 13px;
  font-weight: 500;
}
.online-sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.online-singer {
  text-align: center;
  margin-bottom: 12px;
}
.online-simg {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  object-fit: cover;
}
.online-sname {
  font-size: 12px;
  margin-top: 4px;
}
</style>
