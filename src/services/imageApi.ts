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
  filename: string
  minio_url: string
  original_url: string
  width: number
  height: number
  file_size: number
  format: string
  source_website: string
  group_id: number
  created_at: string
  group_info?: {
    id: number
    name: string
    description: string
  }
}

export interface ApiResponse<T> {
  data: T[]
  total: number
  page: number
  size: number
  total_pages: number
  has_next: boolean
  has_prev: boolean
}

export interface SystemStats {
  total_groups: number
  total_images: number
  sources_stats: Array<{
    source: string
    count: number
  }>
  api_version: string
  description: string
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
   * 获取图片组列表
   */
  async getImageGroups(
    page = 1, 
    size = 20, 
    search?: string
  ): Promise<ApiResponse<ImageGroup>> {
    const params: Record<string, any> = { page, size }
    if (search) {
      params.search = search
    }
    return await this.makeRequest<ApiResponse<ImageGroup>>('GET', '/image-groups', params)
  }

  /**
   * 获取图片组详情
   */
  async getImageGroup(groupId: number): Promise<ImageGroup> {
    return await this.makeRequest<ImageGroup>('GET', `/image-groups/${groupId}`)
  }

  /**
   * 获取图片组中的图片列表
   */
  async getGroupImages(
    groupId: number, 
    page = 1, 
    size = 50
  ): Promise<ApiResponse<ImageData>> {
    const params = { page, size }
    return await this.makeRequest<ApiResponse<ImageData>>('GET', `/image-groups/${groupId}/images`, params)
  }

  /**
   * 获取单张图片详情
   */
  async getImage(imageId: number): Promise<ImageData> {
    return await this.makeRequest<ImageData>('GET', `/images/${imageId}`)
  }

  /**
   * 获取系统统计信息
   */
  async getStats(): Promise<SystemStats> {
    return await this.makeRequest<SystemStats>('GET', '/stats')
  }

  /**
   * 获取所有图片组并随机选择图片
   */
  async getRandomImages(count: number = 120): Promise<ImageData[]> {
    try {
      // 1. 获取系统统计信息
      const stats = await this.getStats()
      console.log(`系统共有 ${stats.total_groups} 个图片组，${stats.total_images} 张图片`)

      // 2. 获取所有图片组
      const allGroups = await this.getImageGroups(1, stats.total_groups)
      
      if (!allGroups.data || allGroups.data.length === 0) {
        throw new Error('没有找到可用的图片组')
      }

      // 3. 从每个图片组中获取图片
      const allImages: ImageData[] = []
      
      for (const group of allGroups.data) {
        try {
          // 获取该组的所有图片
          const groupImages = await this.getGroupImages(group.id, 1, group.image_count)
          if (groupImages.data && groupImages.data.length > 0) {
            allImages.push(...groupImages.data)
          }
        } catch (error) {
          console.warn(`获取图片组 ${group.name} 的图片失败:`, error)
          continue
        }
      }

      console.log(`成功获取 ${allImages.length} 张图片`)

      // 4. 随机选择指定数量的图片
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
      // 1. 搜索相关的图片组
      const groupsResponse = await this.getImageGroups(1, 100, keyword)
      
      if (!groupsResponse.data || groupsResponse.data.length === 0) {
        return []
      }

      // 2. 从相关图片组中获取图片
      const searchResults: ImageData[] = []
      
      for (const group of groupsResponse.data) {
        try {
          const groupImages = await this.getGroupImages(group.id, 1, Math.min(50, group.image_count))
          if (groupImages.data && groupImages.data.length > 0) {
            // 过滤包含关键词的图片
            const filteredImages = groupImages.data.filter(image => 
              image.filename.toLowerCase().includes(keyword.toLowerCase()) ||
              group.name.toLowerCase().includes(keyword.toLowerCase()) ||
              group.description.toLowerCase().includes(keyword.toLowerCase()) ||
              group.search_keyword.toLowerCase().includes(keyword.toLowerCase())
            )
            searchResults.push(...filteredImages)
            
            if (searchResults.length >= limit) {
              break
            }
          }
        } catch (error) {
          console.warn(`搜索图片组 ${group.name} 失败:`, error)
          continue
        }
      }

      // 3. 去重并限制数量
      const uniqueResults = searchResults.filter((image, index, self) => 
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
