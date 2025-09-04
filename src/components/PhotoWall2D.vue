<template>
  <div class="photo-wall-2d">
    
    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-content">
        <div class="spinner"></div>
        <p>正在从API加载图片...</p>
      </div>
    </div>
    
    <!-- 错误状态 -->
    <div v-else-if="error" class="error-overlay">
      <div class="error-content">
        <div class="error-icon">⚠️</div>
        <h3>加载失败</h3>
        <p>{{ error }}</p>
        <button @click="retryLoad" class="retry-btn">重试</button>
      </div>
    </div>
    
    <!-- 正常内容 -->
    <div v-else>
      
      <!-- 瀑布流布局 -->
      <div class="waterfall-layout">
        <div 
          v-for="photo in displayedPhotos" 
          :key="photo.id"
          class="waterfall-item"
        >
          <PhotoNode 
            :photo="photo" 
            :is-selected="selectedPhoto?.id === photo.id"
            :global-description-mode="descriptionMode"
            @photo-click="handlePhotoSelect"
          />
        </div>
      </div>
      
      <!-- 加载更多区域 -->
      <div class="load-more-section">
        <div v-if="isLoadingMore" class="loading-more">
          <div class="spinner"></div>
          <p>正在加载更多图片...</p>
        </div>
        <div v-else-if="!hasMorePhotos" class="no-more-photos">
          <p>已加载所有图片</p>
        </div>
        <div v-else class="load-more-trigger" ref="loadMoreTrigger">
          <p>滚动到底部自动加载更多</p>
        </div>
      </div>
      
      <!-- 照片详情面板 -->
      <div v-if="selectedPhoto" class="photo-detail-panel">
        <div class="panel-header">
          <h3>{{ selectedPhoto.title }}</h3>
          <button @click="closeDetailPanel" class="close-btn">×</button>
        </div>
        
        <div class="panel-content">
          <img :src="selectedPhoto.url" :alt="selectedPhoto.title" class="detail-image" />
          <div class="detail-info">
            <p class="detail-description">{{ selectedPhoto.description }}</p>
            <div class="detail-tags">
              <span v-for="tag in selectedPhoto.tags" :key="tag" class="detail-tag">
                {{ tag }}
              </span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <div class="detail-date">{{ selectedPhoto.date }}</div>
              <button class="select-btn" @click="handleSelectPhoto">选择</button>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 返回顶部按钮 -->
    <button 
      v-if="showBackToTop"
      @click="scrollToTopAndReset"
      class="back-to-top-btn"
      title="返回顶部并重置为120张图片"
    >
      ↑
    </button>
    
    
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { usePhotoStore } from '../stores/photoStore'
import PhotoNode from './PhotoNode.vue'
import type { Photo } from '../stores/photoStore'

interface Props {
  descriptionMode?: boolean
}

withDefaults(defineProps<Props>(), {
  descriptionMode: false
})

const store = usePhotoStore()

// 排序
const sortBy = ref<'date' | 'title' | 'type'>('date')

// 选中的照片
const selectedPhoto = ref<Photo | null>(null)


// 返回顶部按钮状态
const showBackToTop = ref(false)

// 瀑布流列数
const columnCount = ref(5)

// 懒加载相关状态
const displayedPhotos = ref<Photo[]>([])
const currentPage = ref(1)
const pageSize = 120
const isLoadingMore = ref(false)
const hasMorePhotos = ref(true)

// 计算过滤后的照片（所有照片）
const filteredPhotos = computed(() => {
  let photos = store.allImages // 使用所有图片
  
  // 排序
  photos = [...photos].sort((a, b) => {
    switch (sortBy.value) {
      case 'date':
        return new Date(b.date).getTime() - new Date(a.date).getTime()
      case 'title':
        return a.title.localeCompare(b.title)
      case 'type':
        return a.tags[0]?.localeCompare(b.tags[0] || '') || 0
      default:
        return 0
    }
  })
  
  return photos
})

// 加载更多照片
const loadMorePhotos = () => {
  if (isLoadingMore.value || !hasMorePhotos.value) return
  
  isLoadingMore.value = true
  
  // 使用 nextTick 确保 DOM 更新后再处理数据
  nextTick(() => {
    const startIndex = (currentPage.value - 1) * pageSize
    const endIndex = startIndex + pageSize
    const newPhotos = filteredPhotos.value.slice(startIndex, endIndex)
    
    if (newPhotos.length > 0) {
      displayedPhotos.value = [...displayedPhotos.value, ...newPhotos]
      currentPage.value++
      
      // 检查是否还有更多照片
      hasMorePhotos.value = endIndex < filteredPhotos.value.length
    } else {
      hasMorePhotos.value = false
    }
    
    isLoadingMore.value = false
  })
}

// 初始化显示的照片
const initializePhotos = () => {
  displayedPhotos.value = []
  currentPage.value = 1
  hasMorePhotos.value = true
  loadMorePhotos()
}

// 获取加载状态
const isLoading = computed(() => store.isLoading)
const error = computed(() => store.error)




// 选择照片
const handlePhotoSelect = (photo: Photo) => {
  selectedPhoto.value = photo
}

// 关闭详情面板
const closeDetailPanel = () => {
  selectedPhoto.value = null
}

// 重试加载
const retryLoad = async () => {
  try {
    await store.loadImagesFromLocal()
  } catch (error) {
    console.error('重试加载失败:', error)
  }
}

// 处理页面滚动，控制返回顶部按钮显示
const handlePageScroll = () => {
  const scrollContainer = document.querySelector('.photo-wall-2d')
  if (scrollContainer) {
    const scrollTop = scrollContainer.scrollTop
    showBackToTop.value = scrollTop > 300
  }
}

// 设置Intersection Observer来检测滚动到底部
const setupIntersectionObserver = () => {
  const loadMoreTrigger = document.querySelector('.load-more-trigger')
  if (!loadMoreTrigger) {
    console.log('load-more-trigger 元素未找到')
    return
  }
  
  const scrollContainer = document.querySelector('.photo-wall-2d')
  if (!scrollContainer) {
    console.log('滚动容器未找到')
    return
  }
  
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        console.log('Intersection Observer 触发:', {
          isIntersecting: entry.isIntersecting,
          hasMorePhotos: hasMorePhotos.value,
          isLoadingMore: isLoadingMore.value
        })
        
        if (entry.isIntersecting && hasMorePhotos.value && !isLoadingMore.value) {
          console.log('开始加载更多图片')
          loadMorePhotos()
        }
      })
    },
    {
      root: scrollContainer,
      rootMargin: '50px', // 提前50px触发加载
      threshold: 0.1
    }
  )
  
  observer.observe(loadMoreTrigger)
  console.log('Intersection Observer 已设置')
  
  // 返回清理函数
  return () => {
    observer.disconnect()
  }
}

// 返回顶部并重置为120张图片
const scrollToTopAndReset = () => {
  const scrollContainer = document.querySelector('.photo-wall-2d')
  if (scrollContainer) {
    // 立即滚动到顶部
    scrollContainer.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
    
    // 重置懒加载状态，只显示120张图片
    displayedPhotos.value = []
    currentPage.value = 1
    hasMorePhotos.value = true
    loadMorePhotos()
  }
}





// 计算瀑布流列数
const calculateColumnCount = () => {
  const container = document.querySelector('.photo-wall-2d')
  if (!container) return
  
  const containerWidth = container.clientWidth - 80 // 减去padding和滚动条宽度
  const itemWidth = 220 // 每列的理想宽度
  const gap = 12 // 列间距
  
  // 计算能容纳的列数
  const availableWidth = containerWidth + gap
  const calculatedColumns = Math.floor(availableWidth / (itemWidth + gap))
  
  // 限制列数范围
  const newColumnCount = Math.max(1, Math.min(8, calculatedColumns))
  columnCount.value = newColumnCount
  
  // 更新CSS变量
  document.documentElement.style.setProperty('--column-count', newColumnCount.toString())
}

// 初始化瀑布流布局
onMounted(async () => {
  await nextTick()
  
  // 计算初始列数
  calculateColumnCount()
  
  // 初始化照片加载
  initializePhotos()
  
  // 添加滚动事件监听
  const scrollContainer = document.querySelector('.photo-wall-2d')
  if (scrollContainer) {
    scrollContainer.addEventListener('scroll', handlePageScroll)
  }
  
  // 设置Intersection Observer
  let observerCleanup: (() => void) | undefined
  setTimeout(() => {
    observerCleanup = setupIntersectionObserver()
  }, 500) // 减少延迟，确保DOM已渲染
  
  // 监听窗口大小变化
  const handleResize = () => {
    calculateColumnCount()
  }
  
  window.addEventListener('resize', handleResize)
  
  // 清理函数
  return () => {
    window.removeEventListener('resize', handleResize)
    if (observerCleanup) {
      observerCleanup()
    }
  }
})

// 监听数据变化，重新初始化懒加载
watch(() => store.allImages.length, () => {
  if (store.allImages.length > 0) {
    initializePhotos()
  }
}, { immediate: false })

// 监听显示的照片变化，重新设置 Intersection Observer
watch(() => displayedPhotos.value.length, () => {
  if (displayedPhotos.value.length > 0) {
    nextTick(() => {
      setupIntersectionObserver()
    })
  }
}, { immediate: false })

const handleSelectPhoto = () => {
  if (selectedPhoto.value) {
    window.parent.postMessage({
      imageId: selectedPhoto.value.id
    }, '*')
  }
}
</script>

<style scoped>
.photo-wall-2d {
  padding: 20px;
  background: #f5f5f5;
  height: calc(100vh - 70px); /* 进一步减少预留空间 */
  position: relative;
  overflow-y: scroll !important; /* 强制显示滚动条 */
  overflow-x: hidden;
  scroll-behavior: smooth;
}

/* 为PhotoWall2D组件定制滚动条样式 */
.photo-wall-2d::-webkit-scrollbar {
  width: 16px;
}

.photo-wall-2d::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 8px;
}

.photo-wall-2d::-webkit-scrollbar-thumb {
  background: #4CAF50;
  border-radius: 8px;
  border: 2px solid #f5f5f5;
}

.photo-wall-2d::-webkit-scrollbar-thumb:hover {
  background: #45a049;
}

.photo-wall-2d::-webkit-scrollbar-corner {
  background: rgba(0, 0, 0, 0.1);
}


/* 返回顶部按钮样式 */
.back-to-top-btn {
  position: fixed;
  bottom: 10vh;
  right: 20px;
  width: 40px;
  height: 40px;
  background: rgba(76, 175, 80, 0.9);
  color: white;
  border: none;
  border-radius: 50%;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  z-index: 1001;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
}

.back-to-top-btn:hover {
  background: rgba(76, 175, 80, 1);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.back-to-top-btn:active {
  transform: translateY(0);
}





/* 瀑布流布局 */
.waterfall-layout {
  column-count: var(--column-count, 5);
  column-gap: 12px;
  padding: 0;
  min-height: calc(100vh - 240px); /* 根据容器高度调整，确保有足够内容触发滚动条 */
}

.waterfall-item {
  break-inside: avoid;
  margin-bottom: 12px;
  display: block;
  width: 100%;
}

/* 加载更多区域样式 */
.load-more-section {
  margin-top: 20px;
  text-align: center;
  padding: 20px;
}

.loading-more {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  color: #666;
}

.loading-more .spinner {
  width: 24px;
  height: 24px;
  border: 2px solid rgba(76, 175, 80, 0.3);
  border-top: 2px solid #4CAF50;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-more p {
  margin: 0;
  font-size: 14px;
}

.no-more-photos {
  color: #888;
  font-size: 14px;
}

.no-more-photos p {
  margin: 0;
}

.load-more-trigger {
  color: #666;
  font-size: 14px;
}

.load-more-trigger p {
  margin: 0;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}


/* 照片详情面板 */
.photo-detail-panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  border-radius: 16px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  max-width: 95vw;
  max-height: 95vh;
  width: auto;
  min-width: 400px;
  overflow: hidden;
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #eee;
  background: #f8f9fa;
}

.panel-header h3 {
  margin: 0;
  color: #333;
  font-size: 18px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background 0.3s ease;
}

.close-btn:hover {
  background: #f0f0f0;
}

.panel-content {
  padding: 24px;
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.detail-image {
  max-width: 100%;
  max-height: 70vh;
  width: auto;
  height: auto;
  border-radius: 8px;
  margin-bottom: 20px;
  object-fit: contain;
  align-self: center;
}

.detail-info {
  color: #333;
}

.detail-description {
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 16px;
  color: #555;
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.detail-tag {
  background: #e3f2fd;
  color: #1976d2;
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
}

.detail-date {
  font-size: 12px;
  color: #888;
  text-align: right;
}

/* 响应式设计 */
@media (max-width: 600px) {
  .photo-wall-2d {
    padding: 12px 60px 12px 12px;
  }
  
  .photo-detail-panel {
    max-width: 98vw;
    max-height: 98vh;
    min-width: 300px;
    margin: 10px;
  }
  
  .panel-content {
    padding: 16px;
  }
  
  .detail-image {
    max-height: 60vh;
  }
}

/* 加载状态样式 */
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(245, 245, 245, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.loading-content {
  text-align: center;
  color: #333;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(76, 175, 80, 0.3);
  border-top: 4px solid #4CAF50;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-content p {
  font-size: 16px;
  margin: 0;
  color: #666;
}

/* 错误状态样式 */
.error-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(245, 245, 245, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.error-content {
  text-align: center;
  color: #333;
  max-width: 400px;
  padding: 20px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.error-content h3 {
  margin: 0 0 12px 0;
  color: #ff6b6b;
}

.error-content p {
  margin: 0 0 20px 0;
  color: #666;
  line-height: 1.5;
}

.retry-btn {
  background: #4CAF50;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.3s ease;
}

.retry-btn:hover {
  background: #45a049;
}
</style>
