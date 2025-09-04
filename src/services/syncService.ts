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
      // 获取本地存储的图片信息
      const localImages = await indexedDBImageStorage.getAllImages()
      const localImageIds = new Set(localImages.map(img => img.id))
      console.log(`📊 [同步服务6] 本地存储中有 ${localImages.length} 张图片`)
      
      console.log('🌐 [同步服务7] 获取服务器图片组信息...')
      // 获取服务器上的图片组信息
      const imageGroupsResponse = await imageApi.getImageGroups(1, 50)
      const imageGroups = imageGroupsResponse.data || []
      console.log(`📋 [同步服务8] 发现 ${imageGroups.length} 个图片组`)
      console.log('📋 [同步服务8.1] 图片组详情:', imageGroups.map(g => ({ id: g.id, name: g.name, count: g.image_count })))

      let newImages: StoredImageData[] = []
      let updatedImages = 0
      const batchSize = options.batchSize || 50
      const maxImages = options.maxImages || 1000
      console.log(`⚙️ [同步服务9] 同步配置: batchSize=${batchSize}, maxImages=${maxImages}`)

      // 遍历图片组，获取新图片
      for (const group of imageGroups) {
        if (newImages.length >= maxImages) {
          console.log(`🛑 [同步服务10] 已达到最大图片数量限制 ${maxImages}`)
          break
        }
        
        try {
          console.log(`📥 [同步服务11] 获取图片组 ${group.id} (${group.name}) 的图片...`)
          // 获取该组的所有图片，而不是只获取batchSize数量的图片
          const groupImagesResponse = await imageApi.getGroupImages(group.id, 1, group.image_count || 1000)
          const groupImages = groupImagesResponse.data || []
          console.log(`📊 [同步服务12] 图片组 ${group.id} 包含 ${groupImages.length} 张图片 (组内总数: ${group.image_count})`)
          
          for (const apiImage of groupImages) {
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
        } catch (error) {
          console.warn(`⚠️ [同步服务15] 获取图片组 ${group.id} 失败:`, error)
          continue
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

    // 从图片组信息生成描述
    const description = apiImage.group_info 
      ? `${apiImage.group_info.name}: ${apiImage.group_info.description}`
      : `来自 ${apiImage.source_website} 的图片`

    // 从图片组关键词生成标签
    const tags = apiImage.group_info 
      ? apiImage.group_info.description.split(/[,，\s]+/).filter(tag => tag.length > 0)
      : [apiImage.source_website, apiImage.format]

    return {
      id: `photo-${apiImage.id}`,
      url: apiImage.minio_url,
      title,
      description,
      date: apiImage.created_at.split('T')[0],
      tags: tags.slice(0, 5),
      width: apiImage.width,
      height: apiImage.height,
      format: apiImage.format,
      source_website: apiImage.source_website,
      lastUpdated: Date.now(),
      checksum: this.generateChecksum(apiImage)
    }
  }

  // 生成图片校验和
  private generateChecksum(apiImage: ImageData): string {
    const data = `${apiImage.filename}-${apiImage.minio_url}-${apiImage.created_at}`
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
