import { imageApi, type ImageData } from './imageApi'
import { indexedDBImageStorage, type StoredImageData } from './indexedDBStorage'
import type { Photo } from '../stores/photoStore'

export interface SyncResult {
  success: boolean
  newImages: number
  updatedImages: number
  totalImages: number
  error?: string
}

export interface SyncOptions {
  forceSync?: boolean
  batchSize?: number
  maxImages?: number
  clearLocal?: boolean  // 是否清空本地存储
}

class ImageSyncService {
  private isSyncing = false
  private lastSyncTime = 0
  private readonly SYNC_INTERVAL = 30 * 60 * 1000 // 30分钟

  // 检查是否需要同步
  async shouldSync(options: SyncOptions = {}): Promise<boolean> {
    if (options.forceSync) return true
    if (this.isSyncing) return false
    
    const now = Date.now()
    const timeSinceLastSync = now - this.lastSyncTime
    const needsSync = await indexedDBImageStorage.needsSync()
    
    return needsSync || timeSinceLastSync > this.SYNC_INTERVAL
  }

  // 执行增量同步
  async syncImages(options: SyncOptions = {}): Promise<SyncResult> {
    console.log('🔄 [同步服务1] 开始增量同步图片...')
    
    if (this.isSyncing && !options.forceSync) {
      console.log('⚠️ [同步服务2] 同步正在进行中，跳过')
      return {
        success: false,
        newImages: 0,
        updatedImages: 0,
        totalImages: (await indexedDBImageStorage.getAllImages()).length,
        error: '同步正在进行中'
      }
    }

    this.isSyncing = true
    
    try {
      console.log('🧪 [同步服务3] 测试API连接...')
      // 测试API连接
      const connectionTest = await imageApi.testConnection()
      if (!connectionTest) {
        throw new Error('API连接失败')
      }
      console.log('✅ [同步服务4] API连接测试成功')

      console.log('📂 [同步服务5] 获取本地存储信息...')
      
      // 如果设置了清空本地存储，先清空
      if (options.clearLocal) {
        console.log('🗑️ [同步服务5.1] 清空本地存储...')
        await indexedDBImageStorage.clearAllImages()
        console.log('✅ [同步服务5.2] 本地存储已清空')
        
        // 等待一小段时间确保清空操作完成
        await new Promise(resolve => setTimeout(resolve, 100))
        console.log('⏳ [同步服务5.3] 等待清空操作完成...')
      }
      
      // 获取本地存储的图片信息
      const localImages = await indexedDBImageStorage.getAllImages()
      const localImageIds = new Set(localImages.map(img => img.id))
      console.log(`📊 [同步服务6] 本地存储中有 ${localImages.length} 张图片`)
      
      console.log('🌐 [同步服务7] 获取服务器图片信息...')
      // 获取服务器上的图片信息
      const stats = await imageApi.getStats()
      console.log(`📋 [同步服务8] 发现 ${stats.total_datasets} 个数据集，${stats.total_images} 张图片`)

      let newImages: StoredImageData[] = []
      let updatedImages = 0
      const batchSize = options.batchSize || 50
      const maxImages = options.maxImages || 1000
      console.log(`⚙️ [同步服务9] 同步配置: batchSize=${batchSize}, maxImages=${maxImages}`)

      // 分页获取所有图片
      let currentPage = 1
      const pageSize = 100
      
      while (newImages.length < maxImages) {
        try {
          console.log(`📥 [同步服务11] 获取第 ${currentPage} 页图片...`)
          const response = await imageApi.getDatasetImages(currentPage, pageSize)
          const apiImages = response.images || []
          console.log(`📊 [同步服务12] 第 ${currentPage} 页包含 ${apiImages.length} 张图片`)
          
          for (const apiImage of apiImages) {
            if (newImages.length >= maxImages) break
            
            const imageId = `photo-${apiImage.id}`
            
            // 检查是否是新图片
            if (!localImageIds.has(imageId)) {
              console.log(`🆕 [同步服务13] 发现新图片: ${imageId}`)
              const storedImage = this.convertApiImageToStored(apiImage)
              newImages.push(storedImage)
            } else {
              // 检查是否需要更新现有图片
              const existingImage = localImages.find(img => img.id === imageId)
              if (existingImage && this.shouldUpdateImage(existingImage, apiImage)) {
                console.log(`🔄 [同步服务14] 需要更新图片: ${imageId}`)
                const updatedImage = this.convertApiImageToStored(apiImage)
                updatedImages++
                newImages.push(updatedImage)
              }
            }
          }
          
          if (apiImages.length === 0) {
            console.log('📄 [同步服务15] 没有更多图片，同步完成')
            break
          }
          
          currentPage++
        } catch (error) {
          console.warn(`⚠️ [同步服务15] 获取第 ${currentPage} 页图片失败:`, error)
          break
        }
      }

      console.log(`💾 [同步服务16] 准备保存 ${newImages.length} 张图片到本地存储...`)
      // 保存新图片到本地存储
      if (newImages.length > 0) {
        await indexedDBImageStorage.saveImages(newImages)
        console.log(`✅ [同步服务17] 同步完成: 新增 ${newImages.length} 张图片，更新 ${updatedImages} 张图片`)
      } else {
        console.log('ℹ️ [同步服务17] 没有新图片需要同步')
      }

      this.lastSyncTime = Date.now()
      
      const result = {
        success: true,
        newImages: newImages.length,
        updatedImages,
        totalImages: (await indexedDBImageStorage.getAllImages()).length
      }
      
      console.log('🎉 [同步服务18] 同步成功，结果:', result)
      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '同步失败'
      console.error('❌ [同步服务错误] 图片同步失败:', errorMessage)
      console.error('🔍 [同步服务错误详情]', error)
      
      return {
        success: false,
        newImages: 0,
        updatedImages: 0,
        totalImages: (await indexedDBImageStorage.getAllImages()).length,
        error: errorMessage
      }
    } finally {
      this.isSyncing = false
      console.log('🏁 [同步服务完成] 同步流程结束')
    }
  }

  // 转换API图片数据为存储格式
  private convertApiImageToStored(apiImage: ImageData): StoredImageData {
    // 从文件名生成标题
    const title = apiImage.filename.replace(/\.[^/.]+$/, '')
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())

    // 从标签信息生成描述
    const description = apiImage.natural_tags && apiImage.natural_tags.length > 0
      ? apiImage.natural_tags[0]
      : apiImage.phrase_tags && apiImage.phrase_tags.length > 0
      ? apiImage.phrase_tags[0]
      : `数据集 ${apiImage.dataset_id} 中的图片`

    // 合并所有标签
    const allTags = [
      ...(apiImage.type_tags || []),
      ...(apiImage.phrase_tags || []),
      apiImage.format,
      `数据集${apiImage.dataset_id}`
    ].filter(tag => tag && tag.length > 0)

    return {
      id: `photo-${apiImage.id}`,
      url: apiImage.minio_url,
      title,
      description,
      date: apiImage.created_at.split('T')[0],
      tags: allTags.slice(0, 8), // 增加标签数量
      width: apiImage.width,
      height: apiImage.height,
      format: apiImage.format,
      source_website: `dataset-${apiImage.dataset_id}`,
      lastUpdated: Date.now(),
      checksum: this.generateChecksum(apiImage),
      // 新增的元数据字段
      filename: apiImage.filename,
      original_filename: apiImage.original_filename,
      unique_id: apiImage.id,
      type_tags: apiImage.type_tags || [],
      phrase_tags: apiImage.phrase_tags || []
    }
  }

  // 生成图片校验和
  private generateChecksum(apiImage: ImageData): string {
    const data = `${apiImage.filename}-${apiImage.minio_url}-${apiImage.updated_at}-${apiImage.dataset_id}`
    let hash = 0
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转换为32位整数
    }
    return hash.toString()
  }

  // 检查是否需要更新图片
  private shouldUpdateImage(existing: StoredImageData, apiImage: ImageData): boolean {
    const newChecksum = this.generateChecksum(apiImage)
    return existing.checksum !== newChecksum
  }

  // 获取同步状态
  getSyncStatus(): { isSyncing: boolean; lastSyncTime: number } {
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime
    }
  }

  // 强制同步
  async forceSync(): Promise<SyncResult> {
    return this.syncImages({ forceSync: true })
  }

  // 获取本地图片统计
  getLocalStats() {
    return localImageStorage.getStats()
  }
}

export const imageSyncService = new ImageSyncService()
