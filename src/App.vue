<template>
  <div id="app">
    <!-- 根据视图模式显示不同的组件 -->
    <div class="main-content">
      <PhotoViz3D v-if="viewMode === '3d'" />
      <PhotoWall2D v-else :description-mode="descriptionMode" />
    </div>
    
    
    <!-- 底部控制栏 -->
    <footer class="footer">
      <div class="footer-content">
        <!-- 搜索栏 -->
        <div class="search-section">
          <div class="search-container">
            <input
              v-model="searchValue"
              @keydown.enter="handleSearch"
              placeholder="搜索照片..."
              class="search-input"
              ref="searchInput"
            />
            <div class="search-controls">
              <div 
                v-if="isFetching" 
                class="spinner active"
              ></div>
              <button
                v-if="searchValue || highlightNodes.length"
                @click="handleClear"
                class="clear-button"
              >
                ×
              </button>
            </div>
          </div>
        </div>

        <!-- 按钮组 -->
        <div class="button-section">
          <button
            @click="viewMode = '3d'"
            :class="{ active: viewMode === '3d' }"
            class="view-btn"
          >
            3D视图
          </button>
          <button
            @click="viewMode = '2d'"
            :class="{ active: viewMode === '2d' }"
            class="view-btn"
          >
            2D图片墙
          </button>
          <button
            @click="toggleDescriptionMode"
            :class="{ active: descriptionMode }"
            class="view-btn"
          >
            描述
          </button>
          <button
            @click="handleSync"
            class="sync-btn"
            :disabled="isSyncing"
            title="手动同步图片"
          >
            {{ isSyncing ? '同步中...' : '同步图片' }}
          </button>
        </div>
      </div>

      <!-- 同步结果通知 -->
      <div v-if="syncNotification.show" class="sync-notification">
        {{ syncNotification.message }}
      </div>
    </footer>
    
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { usePhotoStore } from './stores/photoStore'
import { sendQuery, clearQuery } from './actions/photoActions'
import PhotoViz3D from './components/PhotoViz3D.vue'
import PhotoWall2D from './components/PhotoWall2D.vue'

const store = usePhotoStore()
const searchInput = ref<HTMLInputElement>()

// 本地状态
const viewMode = ref<'3d' | '2d'>('3d')
const searchValue = ref('')
const descriptionMode = ref(false)

// 同步通知状态
const syncNotification = ref({
  show: false,
  message: ''
})

// 监听视图模式变化
watch(viewMode, async (newMode) => {
  if (newMode === '3d') {
    await store.loadRandomImagesFor3D(120)
  } else {
    store.loadAllImagesFor2D()
  }
})

// 计算属性
const isFetching = computed(() => store.isFetching)
const highlightNodes = computed(() => store.highlightNodes)
const isSyncing = computed(() => store.isSyncing)

// 搜索预设
const searchPresets = [
  'winter', 
  'mathematical concepts', 
  'underwater animals', 
  'circular shapes'
]

// 方法
const handleSearch = () => {
  if (searchValue.value.trim()) {
    sendQuery(searchValue.value.trim())
  }
}

const handleClear = () => {
  clearQuery()
  searchValue.value = ''
  if (searchInput.value) {
    searchInput.value.focus()
  }
}




const handleSync = async () => {
  try {
    await store.manualSync()
    
    // 显示同步结果通知
    syncNotification.value = {
      show: true,
      message: `同步完成！图片已更新`
    }
    
    // 1秒后隐藏通知
    setTimeout(() => {
      syncNotification.value.show = false
    }, 1000)
    
  } catch (error) {
    console.error('手动同步失败:', error)
    
    // 显示错误通知
    syncNotification.value = {
      show: true,
      message: '同步失败，请重试'
    }
    
    setTimeout(() => {
      syncNotification.value.show = false
    }, 1000)
  }
}


// 切换描述模式
const toggleDescriptionMode = () => {
  descriptionMode.value = !descriptionMode.value
  // 这里可以添加全局控制元数据显示的逻辑
  console.log('描述模式:', descriptionMode.value ? '开启' : '关闭')
}

// 自动切换搜索预设
onMounted(async () => {
  // 应用启动时从本地存储加载图片
  try {
    await store.loadImagesFromLocal()
  } catch (error) {
    console.error('启动时加载图片失败:', error)
  }
  
  let presetIndex = 0
  const interval = setInterval(() => {
    presetIndex = (presetIndex + 1) % searchPresets.length
    // 这里可以更新搜索框的 placeholder
  }, 5000)
  
  return () => clearInterval(interval)
})
</script>

<style scoped>
#app {
  min-height: 100vh;
  background: #1a1a1a;
  color: white;
  position: relative;
}

.view-btn {
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
}

.view-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.4);
}

.view-btn.active {
  background: #4CAF50;
  border-color: #4CAF50;
}

.main-content {
  height: calc(100vh - 70px); /* 进一步减少预留空间 */
  overflow: visible; /* 允许子组件滚动 */
}

.footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0, 0, 0, 0.9);
  backdrop-filter: blur(20px);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding: 8px 20px;
  z-index: 100;
}

.footer-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.search-section {
  flex: 1;
  max-width: 400px;
}

.button-section {
  display: flex;
  gap: 8px;
  align-items: center;
}


.search-container {
  position: relative;
  max-width: 400px;
  width: 100%;
}

.search-input {
  width: 100%;
  padding: 10px 40px 10px 16px;
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  color: white;
  font-size: 14px;
  outline: none;
  transition: all 0.3s ease;
}

.search-input:focus {
  border-color: #4CAF50;
  background: rgba(255, 255, 255, 0.15);
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.6);
}

.search-controls {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid #4CAF50;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  opacity: 0;
}

.spinner.active {
  opacity: 1;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.clear-button {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: none;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.3s ease;
}

.clear-button:hover {
  background: rgba(255, 255, 255, 0.3);
}


.sync-btn {
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.1);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.3s ease;
}

.sync-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
}

.sync-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 同步通知样式 */
.sync-notification {
  position: fixed;
  bottom: 80px;
  right: 20px;
  background: rgba(76, 175, 80, 0.95);
  color: white;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  z-index: 1001;
  animation: slideInUp 0.3s ease-out;
}

@keyframes slideInUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}




.icon {
  font-size: 18px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .footer {
    padding: 6px 12px;
  }
  
  .footer-content {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .search-section {
    max-width: none;
  }
  
  .search-input {
    padding: 8px 35px 8px 12px;
    font-size: 13px;
  }
  
  .button-section {
    justify-content: center;
    flex-wrap: wrap;
    gap: 6px;
  }
  
  .view-btn, .sync-btn {
    padding: 4px 8px;
    font-size: 11px;
  }
  
  .sync-notification {
    bottom: 120px;
    right: 12px;
    left: 12px;
    font-size: 13px;
  }
}
</style>
