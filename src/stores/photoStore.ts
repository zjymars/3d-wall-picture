import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { indexedDBImageStorage } from '../services/indexedDBStorage'
import { imageSyncService, type SyncResult } from '../services/syncService'

export interface Photo {
  id: string
  url: string
  title: string
  description: string
  date: string
  tags: string[]
  width?: number
  height?: number
  format?: string
  source_website?: string
}

export interface NodePosition {
  [key: string]: [number, number, number]
}



export const usePhotoStore = defineStore('photo', () => {
  // 状态
  const didInit = ref(false)
  const images = ref<Photo[]>([])
  const allImages = ref<Photo[]>([]) // 存储所有本地图片
  const layout = ref<'sphere' | 'grid'>('sphere')
  const layouts = ref<any>(null)
  const nodePositions = ref<NodePosition>({})
  const highlightNodes = ref<string[]>([])
  const isFetching = ref(false)
  const isSidebarOpen = ref(false)
  const xRayMode = ref(false)
  const targetImage = ref<string | null>(null)
  const caption = ref<string | null>('正在加载图片...')
  const resetCam = ref(false)
  const isLoading = ref(true)
  const error = ref<string | null>(null)
  const isSyncing = ref(false)
  const lastSyncTime = ref(0)
  const syncStatus = ref<string>('')

  // 计算属性
  const filteredImages = computed(() => {
    return images.value
  })

  // 动作
  const setLayout = (newLayout: 'sphere' | 'grid') => {
    layout.value = newLayout
  }

  const setXRayMode = (mode: boolean) => {
    xRayMode.value = mode
  }

  const toggleSidebar = () => {
    isSidebarOpen.value = !isSidebarOpen.value
  }

  const setTargetImage = (imageId: string | null) => {
    targetImage.value = imageId
  }

  const setHighlightNodes = (nodes: string[]) => {
    highlightNodes.value = nodes
  }

  const setCaption = (text: string | null) => {
    caption.value = text
  }

  const setImages = (newImages: Photo[]) => {
    images.value = newImages
  }

  const setNodePositions = (positions: NodePosition) => {
    nodePositions.value = positions
  }

  const setIsFetching = (fetching: boolean) => {
    isFetching.value = fetching
  }

  const setResetCam = (reset: boolean) => {
    resetCam.value = reset
  }

  // 从本地存储加载图片（优化版本）
  const loadImagesFromLocal = async () => {
    console.log('🔄 [优化加载1] 开始从本地存储加载图片...')
    try {
      isLoading.value = true
      error.value = null
      setCaption('正在从本地存储加载图片...')

      console.log('📂 [优化加载2] 并行获取图片数据...')
      // 并行获取所有图片和随机图片，减少等待时间
      const [storedImages, randomStoredImages] = await Promise.all([
        indexedDBImageStorage.getAllImages(),
        indexedDBImageStorage.getRandomImages(120)
      ])
      
      console.log(`📊 [优化加载3] 本地存储中有 ${storedImages.length} 张图片，随机选择了 ${randomStoredImages.length} 张`)
      
      if (storedImages.length === 0) {
        console.log('⚠️ [优化加载4] 本地存储为空，开始同步...')
        await syncWithServer()
        return
      }

      console.log('🔄 [优化加载5] 并行转换图片格式...')
      // 并行转换图片格式
      const [allPhotos, randomPhotos] = await Promise.all([
        Promise.resolve(storedImages.map(img => indexedDBImageStorage.toPhotoFormat(img))),
        Promise.resolve(randomStoredImages.map(img => indexedDBImageStorage.toPhotoFormat(img)))
      ])
      
      console.log(`✅ [优化加载6] 转换完成，共 ${allPhotos.length} 张图片，3D视图显示 ${randomPhotos.length} 张`)
      
      console.log('💾 [优化加载7] 更新应用状态...')
      allImages.value = allPhotos
      setImages(randomPhotos)
      setCaption(`${randomPhotos.length}张精选图片（共${allPhotos.length}张）`)
      
      console.log(`🎉 [优化加载8] 成功从本地存储加载 ${allPhotos.length} 张图片，3D视图显示 ${randomPhotos.length} 张`)
      
      // 标记为已初始化
      didInit.value = true
      console.log('✅ [优化加载9] 初始化完成')
      
      // 显示IndexedDB统计信息
      await showIndexedDBStats()
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '未知错误'
      console.error('❌ [错误] 从本地存储加载图片失败:', errorMessage)
      console.error('🔍 [错误详情]', err)
      
      error.value = `加载图片失败: ${errorMessage}`
      setCaption(`加载失败: ${errorMessage}`)
      
      // 如果本地加载失败，尝试同步
      console.log('🔄 [重试] 尝试与服务器同步...')
      await syncWithServer()
    } finally {
      isLoading.value = false
      console.log('🏁 [完成] 本地加载流程结束')
    }
  }

  // 与服务器同步
  const syncWithServer = async (): Promise<SyncResult> => {
    console.log('🌐 [同步1] 开始与服务器同步图片...')
    try {
      isSyncing.value = true
      setCaption('正在与服务器同步图片...')
      syncStatus.value = '正在同步...'

      console.log('🔧 [同步2] 调用同步服务...')
      const result = await imageSyncService.syncImages({
        batchSize: 50,
        maxImages: 1000
      })

      console.log('📊 [同步3] 同步结果:', result)

      if (result.success) {
        console.log('✅ [同步4] 同步成功，重新加载本地图片...')
        // 同步成功后重新加载本地图片
        await loadImagesFromLocal()
        syncStatus.value = `同步完成: 新增 ${result.newImages} 张，更新 ${result.updatedImages} 张`
        lastSyncTime.value = Date.now()
        console.log('🎉 [同步5] 同步流程完成')
        
        // 显示同步后的统计信息
        console.log('📊 [同步后统计] 显示同步后的IndexedDB统计信息...')
        await showIndexedDBStats()
      } else {
        console.error('❌ [同步6] 同步失败:', result.error)
        throw new Error(result.error || '同步失败')
      }

      return result
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '同步失败'
      console.error('❌ [同步错误] 同步失败:', errorMessage)
      console.error('🔍 [同步错误详情]', err)
      
      error.value = `同步失败: ${errorMessage}`
      setCaption(`同步失败: ${errorMessage}`)
      syncStatus.value = `同步失败: ${errorMessage}`
      
      // 如果同步失败，尝试使用本地存储
      console.log('🔄 [同步重试] 尝试使用本地存储...')
      if (allImages.value.length > 0) {
        const randomStoredImages = await indexedDBImageStorage.getRandomImages(120)
        const randomPhotos = randomStoredImages.map(img => indexedDBImageStorage.toPhotoFormat(img))
        setImages(randomPhotos)
        setCaption(`使用本地存储: ${randomPhotos.length} 张图片`)
        console.log(`✅ [同步重试] 使用本地存储成功: ${randomPhotos.length} 张图片`)
      } else {
        console.log('⚠️ [同步重试] 本地存储也为空')
      }
      
      throw err
    } finally {
      isSyncing.value = false
      console.log('🏁 [同步完成] 同步流程结束')
    }
  }



  // 搜索图片（在本地存储中搜索）
  const searchImages = async (keyword: string) => {
    try {
      setIsFetching(true)
      setCaption(`正在搜索 "${keyword}" 相关的图片...`)
      
      // 在本地存储中搜索
      const searchResults = await indexedDBImageStorage.searchImages(keyword)
      
      if (searchResults.length === 0) {
        setCaption(`未找到与 "${keyword}" 相关的图片`)
        setImages([])
        return
      }
      
      const convertedResults = searchResults.map(img => indexedDBImageStorage.toPhotoFormat(img))
      setImages(convertedResults)
      setCaption(`找到 ${convertedResults.length} 张与 "${keyword}" 相关的图片`)
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '搜索失败'
      console.error('搜索图片失败:', errorMessage)
      setCaption(`搜索失败: ${errorMessage}`)
    } finally {
      setIsFetching(false)
    }
  }

  // 重置为初始图片
  const resetToInitial = async () => {
    await loadImagesFromLocal()
  }

  // 为3D视图加载随机图片（优化版本）
  const loadRandomImagesFor3D = async (count: number = 120) => {
    console.log(`🎲 [3D优化] 开始为3D视图加载 ${count} 张随机图片...`)
    
    // 如果已经有所有图片数据，直接从其中随机选择，避免重复数据库查询
    if (allImages.value.length > 0) {
      console.log(`📊 [3D优化] 从已加载的 ${allImages.value.length} 张图片中随机选择...`)
      
      // 使用更高效的随机选择算法，避免完整洗牌
      const randomImages: Photo[] = []
      const availableIndices = Array.from({ length: allImages.value.length }, (_, i) => i)
      
      for (let i = 0; i < Math.min(count, allImages.value.length); i++) {
        const randomIndex = Math.floor(Math.random() * availableIndices.length)
        const selectedIndex = availableIndices.splice(randomIndex, 1)[0]
        randomImages.push(allImages.value[selectedIndex])
      }
      setImages(randomImages)
      setCaption(`${randomImages.length}张精选图片（共${allImages.value.length}张）`)
      console.log(`✅ [3D优化] 成功选择 ${randomImages.length} 张图片`)
      return
    }
    
    // 如果没有已加载的图片，从数据库获取
    console.log(`📂 [3D优化] 从数据库获取随机图片...`)
    const randomStoredImages = await indexedDBImageStorage.getRandomImages(count)
    const randomImages = randomStoredImages.map(img => indexedDBImageStorage.toPhotoFormat(img))
    const totalCount = allImages.value.length
    setImages(randomImages)
    setCaption(`${randomImages.length}张精选图片（共${totalCount}张）`)
    console.log(`✅ [3D优化] 从数据库获取 ${randomImages.length} 张图片`)
  }

  // 为2D视图加载所有图片
  const loadAllImagesFor2D = () => {
    setImages(allImages.value)
    setCaption(`${allImages.value.length}张精选图片（共${allImages.value.length}张）`)
  }

  // 手动同步
  const manualSync = async () => {
    return await syncWithServer()
  }

  // 获取存储统计信息
  const getStorageStats = async () => {
    return await indexedDBImageStorage.getStats()
  }

  // 显示IndexedDB统计信息
  const showIndexedDBStats = async () => {
    try {
      console.log('📊 [统计] 开始统计IndexedDB中的图片数量...')
      
      const stats = await indexedDBImageStorage.getStats()
      const allImages = await indexedDBImageStorage.getAllImages()
      
      console.log('='.repeat(60))
      console.log('📈 [IndexedDB统计报告]')
      console.log('='.repeat(60))
      console.log(`📁 总图片数量: ${stats.totalImages} 张`)
      console.log(`💾 存储大小: ${(stats.storageSize / 1024).toFixed(2)} KB`)
      console.log(`🕒 最后同步时间: ${new Date(stats.lastSyncTime).toLocaleString()}`)
      console.log(`📊 实际图片数组长度: ${allImages.length} 张`)
      
      // 按来源网站统计
      const sourceStats = allImages.reduce((acc, img) => {
        const source = img.source_website || '未知来源'
        acc[source] = (acc[source] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      
      console.log('\n📂 [按来源网站统计]')
      Object.entries(sourceStats).forEach(([source, count]) => {
        console.log(`  ${source}: ${count} 张`)
      })
      
      // 按格式统计
      const formatStats = allImages.reduce((acc, img) => {
        const format = img.format || '未知格式'
        acc[format] = (acc[format] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      
      console.log('\n🖼️ [按图片格式统计]')
      Object.entries(formatStats).forEach(([format, count]) => {
        console.log(`  ${format}: ${count} 张`)
      })
      
      console.log('='.repeat(60))
      console.log('✅ [统计完成] IndexedDB统计报告已生成')
      console.log('='.repeat(60))
      
      return {
        totalImages: stats.totalImages,
        storageSize: stats.storageSize,
        lastSyncTime: stats.lastSyncTime,
        sourceStats,
        formatStats
      }
    } catch (error) {
      console.error('❌ [统计错误] 获取IndexedDB统计信息失败:', error)
      return null
    }
  }


  // 添加新照片
  const addPhoto = (photo: Photo) => {
    images.value.push(photo)
    setCaption(`已加载 ${images.value.length} 张精美图片`)
  }

  // 清空所有照片
  const clearAllPhotos = () => {
    images.value = []
    setCaption(null)
  }

  return {
    // 状态
    didInit,
    images,
    allImages,
    layout,
    layouts,
    nodePositions,
    highlightNodes,
    isFetching,
    isSidebarOpen,
    xRayMode,
    targetImage,
    caption,
    resetCam,
    isLoading,
    error,
    isSyncing,
    lastSyncTime,
    syncStatus,
    
    // 计算属性
    filteredImages,
    
    // 动作
    setLayout,
    setXRayMode,
    toggleSidebar,
    setTargetImage,
    setHighlightNodes,
    setCaption,
    setImages,
    setNodePositions,
    setIsFetching,
    setResetCam,
    addPhoto,
    clearAllPhotos,
    resetToInitial,
    loadImagesFromLocal,

    searchImages,
    syncWithServer,
    loadRandomImagesFor3D,
    loadAllImagesFor2D,
    manualSync,
    getStorageStats,
    showIndexedDBStats
  }
})
