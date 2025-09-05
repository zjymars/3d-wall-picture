import type { Photo } from '../stores/photoStore'

export interface StoredImageData {
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
  lastUpdated: number
  checksum?: string
  // 新增的元数据字段
  filename?: string
  original_filename?: string
  unique_id?: number
  type_tags?: string[]
  phrase_tags?: string[]
}

export interface StorageStats {
  totalImages: number
  lastSyncTime: number
  storageSize: number
}

class LocalImageStorage {
  private readonly STORAGE_KEY = 'image_storage'
  private readonly STATS_KEY = 'storage_stats'
  private readonly MAX_STORAGE_SIZE = 50 * 1024 * 1024 // 50MB

  // 获取所有存储的图片
  getAllImages(): StoredImageData[] {
    try {
      console.log('📂 [本地存储1] 从localStorage获取图片数据...')
      const stored = localStorage.getItem(this.STORAGE_KEY)
      const images = stored ? JSON.parse(stored) : []
      console.log(`📊 [本地存储2] 成功获取 ${images.length} 张图片`)
      return images
    } catch (error) {
      console.error('❌ [本地存储错误] 获取本地图片存储失败:', error)
      return []
    }
  }

  // 保存图片到本地存储
  saveImages(images: StoredImageData[]): void {
    try {
      console.log(`💾 [本地存储3] 开始保存 ${images.length} 张图片到本地存储...`)
      const currentImages = this.getAllImages()
      const imageMap = new Map(currentImages.map(img => [img.id, img]))
      console.log(`📊 [本地存储4] 当前存储中有 ${currentImages.length} 张图片`)
      
      // 合并新图片，更新已存在的图片
      images.forEach(newImage => {
        imageMap.set(newImage.id, {
          ...newImage,
          lastUpdated: Date.now()
        })
      })

      const allImages = Array.from(imageMap.values())
      console.log(`📊 [本地存储5] 合并后共有 ${allImages.length} 张图片`)
      
      // 检查存储大小限制
      const storageSize = this.calculateStorageSize(allImages)
      console.log(`📏 [本地存储6] 存储大小: ${storageSize} bytes (限制: ${this.MAX_STORAGE_SIZE} bytes)`)
      
      if (storageSize > this.MAX_STORAGE_SIZE) {
        // 如果超过限制，删除最旧的图片
        console.log('⚠️ [本地存储7] 存储空间不足，开始清理旧图片...')
        allImages.sort((a, b) => a.lastUpdated - b.lastUpdated)
        const imagesToKeep = Math.floor(allImages.length * 0.8) // 保留80%
        const trimmedImages = allImages.slice(-imagesToKeep)
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(trimmedImages))
        console.log(`🗑️ [本地存储8] 删除了 ${allImages.length - trimmedImages.length} 张旧图片，保留 ${trimmedImages.length} 张`)
      } else {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(allImages))
        console.log(`✅ [本地存储9] 成功保存 ${allImages.length} 张图片到localStorage`)
      }

      this.updateStats()
      console.log('📊 [本地存储10] 存储统计信息已更新')
    } catch (error) {
      console.error('❌ [本地存储错误] 保存图片到本地存储失败:', error)
    }
  }

  // 获取随机图片
  getRandomImages(count: number): StoredImageData[] {
    const allImages = this.getAllImages()
    if (allImages.length === 0) return []

    const shuffled = [...allImages].sort(() => 0.5 - Math.random())
    return shuffled.slice(0, Math.min(count, allImages.length))
  }

  // 根据ID获取图片
  getImageById(id: string): StoredImageData | null {
    const allImages = this.getAllImages()
    return allImages.find(img => img.id === id) || null
  }

  // 搜索图片
  searchImages(keyword: string): StoredImageData[] {
    const allImages = this.getAllImages()
    const lowerKeyword = keyword.toLowerCase()
    
    return allImages.filter(img => 
      img.title.toLowerCase().includes(lowerKeyword) ||
      img.description.toLowerCase().includes(lowerKeyword) ||
      img.tags.some(tag => tag.toLowerCase().includes(lowerKeyword))
    )
  }

  // 获取存储统计信息
  getStats(): StorageStats {
    try {
      const stored = localStorage.getItem(this.STATS_KEY)
      const stats = stored ? JSON.parse(stored) : { totalImages: 0, lastSyncTime: 0, storageSize: 0 }
      
      // 更新当前统计信息
      const allImages = this.getAllImages()
      stats.totalImages = allImages.length
      stats.storageSize = this.calculateStorageSize(allImages)
      
      return stats
    } catch (error) {
      console.error('获取存储统计信息失败:', error)
      return { totalImages: 0, lastSyncTime: 0, storageSize: 0 }
    }
  }

  // 更新统计信息
  private updateStats(): void {
    const stats = this.getStats()
    stats.lastSyncTime = Date.now()
    localStorage.setItem(this.STATS_KEY, JSON.stringify(stats))
  }

  // 计算存储大小
  private calculateStorageSize(images: StoredImageData[]): number {
    return new Blob([JSON.stringify(images)]).size
  }

  // 清空所有存储
  clearAll(): void {
    localStorage.removeItem(this.STORAGE_KEY)
    localStorage.removeItem(this.STATS_KEY)
  }

  // 检查是否需要同步（基于时间或图片数量）
  needsSync(): boolean {
    const stats = this.getStats()
    const now = Date.now()
    const oneHour = 60 * 60 * 1000
    
    // 如果超过1小时没有同步，或者没有图片，则需要同步
    return (now - stats.lastSyncTime) > oneHour || stats.totalImages === 0
  }

  // 转换为Photo格式
  toPhotoFormat(storedImage: StoredImageData): Photo {
    return {
      id: storedImage.id,
      url: storedImage.url,
      title: storedImage.title,
      description: storedImage.description,
      date: storedImage.date,
      tags: storedImage.tags,
      width: storedImage.width,
      height: storedImage.height,
      format: storedImage.format,
      source_website: storedImage.source_website
    }
  }

  // 从Photo格式转换
  fromPhotoFormat(photo: Photo): StoredImageData {
    return {
      id: photo.id,
      url: photo.url,
      title: photo.title,
      description: photo.description,
      date: photo.date,
      tags: photo.tags,
      width: photo.width,
      height: photo.height,
      format: photo.format,
      source_website: photo.source_website,
      lastUpdated: Date.now()
    }
  }
}

export const localImageStorage = new LocalImageStorage()
