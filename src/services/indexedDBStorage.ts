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
}

export interface StorageStats {
  totalImages: number
  lastSyncTime: number
  storageSize: number
}

class IndexedDBImageStorage {
  private readonly DB_NAME = 'ImageStorageDB'
  private readonly DB_VERSION = 1
  private readonly STORE_NAME = 'images'
  private readonly STATS_STORE_NAME = 'stats'
  private db: IDBDatabase | null = null
  
  // 内存缓存，避免重复的数据库查询
  private imageCache: StoredImageData[] | null = null
  private cacheTimestamp: number = 0
  private readonly CACHE_DURATION = 5 * 60 * 1000 // 5分钟缓存

  // 初始化数据库
  private async initDB(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION)

      request.onerror = () => {
        console.error('❌ [IndexedDB错误] 打开数据库失败:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        console.log('✅ [IndexedDB] 数据库连接成功')
        this.db = request.result
        resolve(this.db)
      }

      request.onupgradeneeded = (event) => {
        console.log('🔄 [IndexedDB] 数据库升级中...')
        const db = (event.target as IDBOpenDBRequest).result

        // 创建图片存储
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const imageStore = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' })
          imageStore.createIndex('lastUpdated', 'lastUpdated', { unique: false })
          imageStore.createIndex('source_website', 'source_website', { unique: false })
          console.log('✅ [IndexedDB] 图片存储创建成功')
        }

        // 创建统计信息存储
        if (!db.objectStoreNames.contains(this.STATS_STORE_NAME)) {
          db.createObjectStore(this.STATS_STORE_NAME, { keyPath: 'key' })
          console.log('✅ [IndexedDB] 统计信息存储创建成功')
        }
      }
    })
  }

  // 获取所有存储的图片（带缓存优化）
  async getAllImages(): Promise<StoredImageData[]> {
    try {
      // 检查缓存是否有效
      const now = Date.now()
      if (this.imageCache && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
        console.log(`📂 [缓存命中] 从内存缓存获取 ${this.imageCache.length} 张图片`)
        return this.imageCache
      }

      console.log('📂 [IndexedDB1] 从IndexedDB获取图片数据...')
      const db = await this.initDB()
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.STORE_NAME], 'readonly')
        const store = transaction.objectStore(this.STORE_NAME)
        const request = store.getAll()

        request.onsuccess = () => {
          const images = request.result || []
          console.log(`📊 [IndexedDB2] 成功获取 ${images.length} 张图片`)
          
          // 更新缓存
          this.imageCache = images
          this.cacheTimestamp = now
          console.log('💾 [缓存更新] 图片数据已缓存')
          
          resolve(images)
        }

        request.onerror = () => {
          console.error('❌ [IndexedDB错误] 获取图片失败:', request.error)
          reject(request.error)
        }
      })
    } catch (error) {
      console.error('❌ [IndexedDB错误] 获取图片数据失败:', error)
      return []
    }
  }

  // 保存图片到IndexedDB
  async saveImages(images: StoredImageData[]): Promise<void> {
    try {
      console.log(`💾 [IndexedDB3] 开始保存 ${images.length} 张图片到IndexedDB...`)
      const db = await this.initDB()
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.STORE_NAME], 'readwrite')
        const store = transaction.objectStore(this.STORE_NAME)
        
        let completed = 0
        let hasError = false

        images.forEach(image => {
          const request = store.put({
            ...image,
            lastUpdated: Date.now()
          })

          request.onsuccess = () => {
            completed++
            if (completed === images.length && !hasError) {
              console.log(`✅ [IndexedDB4] 成功保存 ${images.length} 张图片到IndexedDB`)
              // 清除缓存，确保数据一致性
              this.imageCache = null
              this.cacheTimestamp = 0
              console.log('🗑️ [缓存清除] 保存后清除缓存')
              this.updateStats()
              resolve()
            }
          }

          request.onerror = () => {
            if (!hasError) {
              hasError = true
              console.error('❌ [IndexedDB错误] 保存图片失败:', request.error)
              reject(request.error)
            }
          }
        })
      })
    } catch (error) {
      console.error('❌ [IndexedDB错误] 保存图片到IndexedDB失败:', error)
      throw error
    }
  }

  // 获取随机图片（优化版本，使用缓存）
  async getRandomImages(count: number): Promise<StoredImageData[]> {
    try {
      console.log(`🎲 [IndexedDB优化] 开始获取 ${count} 张随机图片...`)
      
      // 使用缓存的数据，避免重复数据库查询
      const allImages = await this.getAllImages()
      
      if (allImages.length === 0) {
        console.log('⚠️ [IndexedDB优化] 没有找到图片')
        return []
      }

      // 使用Fisher-Yates洗牌算法，更高效
      const shuffled = [...allImages]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }
      
      const result = shuffled.slice(0, Math.min(count, allImages.length))
      console.log(`✅ [IndexedDB优化] 成功获取 ${result.length} 张随机图片`)
      return result
    } catch (error) {
      console.error('❌ [IndexedDB错误] 获取随机图片失败:', error)
      return []
    }
  }

  // 根据ID获取图片
  async getImageById(id: string): Promise<StoredImageData | null> {
    try {
      const db = await this.initDB()
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.STORE_NAME], 'readonly')
        const store = transaction.objectStore(this.STORE_NAME)
        const request = store.get(id)

        request.onsuccess = () => {
          resolve(request.result || null)
        }

        request.onerror = () => {
          reject(request.error)
        }
      })
    } catch (error) {
      console.error('❌ [IndexedDB错误] 根据ID获取图片失败:', error)
      return null
    }
  }

  // 搜索图片
  async searchImages(keyword: string): Promise<StoredImageData[]> {
    try {
      const allImages = await this.getAllImages()
      const lowerKeyword = keyword.toLowerCase()
      
      return allImages.filter(img => 
        img.title.toLowerCase().includes(lowerKeyword) ||
        img.description.toLowerCase().includes(lowerKeyword) ||
        img.tags.some(tag => tag.toLowerCase().includes(lowerKeyword))
      )
    } catch (error) {
      console.error('❌ [IndexedDB错误] 搜索图片失败:', error)
      return []
    }
  }

  // 获取存储统计信息
  async getStats(): Promise<StorageStats> {
    try {
      const db = await this.initDB()
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.STATS_STORE_NAME], 'readonly')
        const store = transaction.objectStore(this.STATS_STORE_NAME)
        const request = store.get('main')

        request.onsuccess = () => {
          const stats = request.result?.value || { totalImages: 0, lastSyncTime: 0, storageSize: 0 }
          
          // 更新当前统计信息
          this.getAllImages().then(images => {
            stats.totalImages = images.length
            stats.storageSize = this.calculateStorageSize(images)
            resolve(stats)
          })
        }

        request.onerror = () => {
          reject(request.error)
        }
      })
    } catch (error) {
      console.error('❌ [IndexedDB错误] 获取存储统计信息失败:', error)
      return { totalImages: 0, lastSyncTime: 0, storageSize: 0 }
    }
  }

  // 更新统计信息
  private async updateStats(): Promise<void> {
    try {
      const db = await this.initDB()
      const images = await this.getAllImages()
      
      const stats = {
        key: 'main',
        value: {
          totalImages: images.length,
          lastSyncTime: Date.now(),
          storageSize: this.calculateStorageSize(images)
        }
      }

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.STATS_STORE_NAME], 'readwrite')
        const store = transaction.objectStore(this.STATS_STORE_NAME)
        const request = store.put(stats)

        request.onsuccess = () => {
          console.log('📊 [IndexedDB] 存储统计信息已更新')
          resolve()
        }

        request.onerror = () => {
          reject(request.error)
        }
      })
    } catch (error) {
      console.error('❌ [IndexedDB错误] 更新统计信息失败:', error)
    }
  }

  // 计算存储大小（估算）
  private calculateStorageSize(images: StoredImageData[]): number {
    // 估算每张图片元数据的大小（约1KB）
    return images.length * 1024
  }

  // 清空所有存储
  async clearAll(): Promise<void> {
    try {
      const db = await this.initDB()
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.STORE_NAME, this.STATS_STORE_NAME], 'readwrite')
        
        const imageStore = transaction.objectStore(this.STORE_NAME)
        const statsStore = transaction.objectStore(this.STATS_STORE_NAME)
        
        const imageRequest = imageStore.clear()
        const statsRequest = statsStore.clear()
        
        let completed = 0
        const onComplete = () => {
          completed++
          if (completed === 2) {
            console.log('🗑️ [IndexedDB] 所有存储已清空')
            resolve()
          }
        }

        imageRequest.onsuccess = onComplete
        statsRequest.onsuccess = onComplete
        
        imageRequest.onerror = () => reject(imageRequest.error)
        statsRequest.onerror = () => reject(statsRequest.error)
      })
    } catch (error) {
      console.error('❌ [IndexedDB错误] 清空存储失败:', error)
      throw error
    }
  }

  // 检查是否需要同步（基于时间或图片数量）
  async needsSync(): Promise<boolean> {
    try {
      const stats = await this.getStats()
      const now = Date.now()
      const oneHour = 60 * 60 * 1000
      
      // 如果超过1小时没有同步，或者没有图片，则需要同步
      return (now - stats.lastSyncTime) > oneHour || stats.totalImages === 0
    } catch (error) {
      console.error('❌ [IndexedDB错误] 检查同步状态失败:', error)
      return true // 出错时默认需要同步
    }
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

export const indexedDBImageStorage = new IndexedDBImageStorage()
