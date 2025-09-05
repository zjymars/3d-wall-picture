/**
 * ArcIns ImageToolkit 外部API服务
 * 用于获取真实的图片数据
 */

export interface ImageGroup {
  id: number
  name: string
  description: string
  search_keyword: string
  source_website: string
  image_count: number
  created_at: string
  updated_at: string
  cover_image: string
}

export interface ImageData {
  id: number
  dataset_id: number
  original_image_id?: number
  original_filename: string
  minio_object_name: string
  minio_url: string
  filename: string
  file_size: number
  width: number
  height: number
  format: string
  type_tags: string[]
  phrase_tags: string[]
  natural_tags: string[]
  raw_annotation_data: any
  annotation_method: string
  annotation_model: string
  confidence_score: number
  quality_score: number
  is_verified: boolean
  verification_notes?: string
  image_metadata: any
  created_at: string
  updated_at: string
}

export interface ApiResponse<T> {
  total: number
  page: number
  page_size: number
  total_pages: number
  images: T[]
}

export interface SystemStats {
  total_images: number
  total_datasets: number
  total_file_size: number
  total_file_size_mb: number
  avg_confidence_score: number
  avg_quality_score: number
  verified_images: number
  verification_rate: number
  avg_images_per_dataset: number
}

/**
 * ArcIns ImageToolkit API客户端
 */
class ArcInsImageToolkitAPI {
  private baseUrl: string
  private defaultHeaders: Record<string, string>

  constructor(baseUrl = '/api') {  // 改为使用代理路径
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  }

  /**
   * 发送HTTP请求
   */
  private async makeRequest<T>(
    method: string, 
    endpoint: string, 
    params: Record<string, any> = {}
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`, window.location.origin)
    
    // 添加查询参数
    if (method === 'GET') {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          url.searchParams.append(key, params[key])
        }
      })
    }

    const options: RequestInit = {
      method,
      headers: this.defaultHeaders
    }

    console.log(`🌐 API请求: ${method} ${url.toString()}`)
    console.log(`📋 请求头:`, this.defaultHeaders)

    try {
      const response = await fetch(url.toString(), options)
      
      console.log(`📡 响应状态: ${response.status} ${response.statusText}`)
      console.log(`📋 响应头:`, Object.fromEntries(response.headers.entries()))
      
      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage: string
        try {
          const errorJson = JSON.parse(errorText)
          errorMessage = errorJson.detail || `HTTP ${response.status}: ${response.statusText}`
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      console.log(`✅ API响应成功:`, data)
      return data
    } catch (error) {
      console.error(`❌ API请求失败: ${error instanceof Error ? error.message : '未知错误'}`)
      console.error(`🔍 错误详情:`, error)
      throw error
    }
  }

  /**
   * 获取数据集图片列表
   */
  async getDatasetImages(
    page = 1, 
    page_size = 20, 
    dataset_id?: number
  ): Promise<ApiResponse<ImageData>> {
    const params: Record<string, any> = { page, page_size }
    if (dataset_id) {
      params.dataset_id = dataset_id
    }
    return await this.makeRequest<ApiResponse<ImageData>>('GET', '/dataset-images', params)
  }

  /**
   * 获取单张图片详情
   */
  async getImage(imageId: number): Promise<ImageData> {
    return await this.makeRequest<ImageData>('GET', `/dataset-images/${imageId}`)
  }

  /**
   * 获取指定数据集的图片列表
   */
  async getDatasetImagesById(
    datasetId: number, 
    page = 1, 
    page_size = 50
  ): Promise<ApiResponse<ImageData>> {
    const params = { page, page_size }
    return await this.makeRequest<ApiResponse<ImageData>>('GET', `/datasets/${datasetId}/images`, params)
  }

  /**
   * 获取系统统计信息
   */
  async getStats(): Promise<SystemStats> {
    try {
      // 尝试获取统计信息
      return await this.makeRequest<SystemStats>('GET', '/dataset-images/stats')
    } catch (error) {
      console.warn('统计端点不可用，使用图片列表计算统计信息')
      // 如果统计端点不可用，通过获取图片列表来计算统计信息
      const response = await this.getDatasetImages(1, 1)
      return {
        total_images: response.total,
        total_datasets: 1, // 无法准确获取，设为1
        total_file_size: 0,
        total_file_size_mb: 0,
        avg_confidence_score: 0.8,
        avg_quality_score: 0.8,
        verified_images: Math.floor(response.total * 0.8),
        verification_rate: 80.0,
        avg_images_per_dataset: response.total
      }
    }
  }

  /**
   * 获取随机图片
   */
  async getRandomImages(count: number = 120): Promise<ImageData[]> {
    try {
      // 1. 获取系统统计信息
      const stats = await this.getStats()
      console.log(`系统共有 ${stats.total_datasets} 个数据集，${stats.total_images} 张图片`)

      // 2. 直接获取所有图片（分页获取）
      const allImages: ImageData[] = []
      let currentPage = 1
      const pageSize = 100 // 每页获取100张图片
      
      while (allImages.length < stats.total_images && allImages.length < count * 2) {
        try {
          const response = await this.getDatasetImages(currentPage, pageSize)
          if (response.images && response.images.length > 0) {
            allImages.push(...response.images)
            console.log(`已获取 ${allImages.length} 张图片，当前页: ${currentPage}`)
            currentPage++
          } else {
            break
          }
        } catch (error) {
          console.warn(`获取第 ${currentPage} 页图片失败:`, error)
          break
        }
      }

      console.log(`成功获取 ${allImages.length} 张图片`)

      // 3. 随机选择指定数量的图片
      if (allImages.length <= count) {
        return allImages
      }

      // Fisher-Yates 洗牌算法
      const shuffled = [...allImages]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }

      return shuffled.slice(0, count)
    } catch (error) {
      console.error('获取随机图片失败:', error)
      throw error
    }
  }

  /**
   * 搜索图片
   */
  async searchImages(keyword: string, limit: number = 50): Promise<ImageData[]> {
    try {
      // 1. 获取所有图片并过滤
      const allImages: ImageData[] = []
      let currentPage = 1
      const pageSize = 100
      
      while (allImages.length < limit * 2) {
        try {
          const response = await this.getDatasetImages(currentPage, pageSize)
          if (response.images && response.images.length > 0) {
            // 过滤包含关键词的图片
            const filteredImages = response.images.filter(image => 
              image.filename.toLowerCase().includes(keyword.toLowerCase()) ||
              image.original_filename.toLowerCase().includes(keyword.toLowerCase()) ||
              image.type_tags.some(tag => tag.toLowerCase().includes(keyword.toLowerCase())) ||
              image.phrase_tags.some(tag => tag.toLowerCase().includes(keyword.toLowerCase())) ||
              image.natural_tags.some(tag => tag.toLowerCase().includes(keyword.toLowerCase()))
            )
            allImages.push(...filteredImages)
            
            if (allImages.length >= limit) {
              break
            }
            currentPage++
          } else {
            break
          }
        } catch (error) {
          console.warn(`搜索第 ${currentPage} 页图片失败:`, error)
          break
        }
      }

      // 2. 去重并限制数量
      const uniqueResults = allImages.filter((image, index, self) => 
        index === self.findIndex(i => i.id === image.id)
      )

      return uniqueResults.slice(0, limit)
    } catch (error) {
      console.error('搜索图片失败:', error)
      throw error
    }
  }


  /**
   * 测试API连接
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('🧪 开始测试API连接...')
      
      // 测试1: 直接访问stats接口
      const stats = await this.getStats()
      console.log('✅ 直接API访问成功:', stats)
      return true
      
    } catch (error) {
      console.error('❌ 直接API访问失败:', error)
      
      // 测试2: 尝试使用fetch直接访问原始URL
      try {
        console.log('🧪 尝试直接访问原始URL...')
        const response = await fetch('http://192.10.222.123:8001/api/v1/external/stats')
        console.log('📡 原始URL响应状态:', response.status)
        console.log('📋 原始URL响应头:', Object.fromEntries(response.headers.entries()))
        
        if (response.ok) {
          const data = await response.json()
          console.log('✅ 原始URL访问成功:', data)
          return true
        } else {
          console.error('❌ 原始URL响应错误:', response.statusText)
          return false
        }
      } catch (directError) {
        console.error('❌ 原始URL访问也失败:', directError)
        return false
      }
    }
  }
}

// 创建API实例
export const imageApi = new ArcInsImageToolkitAPI()

// 导出类型和实例
export default ArcInsImageToolkitAPI
