import { usePhotoStore } from '../stores/photoStore'

export const sendQuery = async (query: string) => {
  const store = usePhotoStore()
  
  if (!query.trim()) {
    return
  }
  
  try {
    // 使用新的API搜索方法
    await store.searchImages(query.trim())
  } catch (error) {
    console.error('搜索失败:', error)
    store.setCaption('搜索失败，请重试')
  }
}

export const clearQuery = () => {
  const store = usePhotoStore()
  // 恢复到初始图片状态
  store.resetToInitial()
  store.setHighlightNodes([])
  store.setTargetImage(null)
}

export const setLayout = (layout: 'sphere' | 'grid') => {
  const store = usePhotoStore()
  store.setLayout(layout)
}

export const setXRayMode = (mode: boolean) => {
  const store = usePhotoStore()
  store.setXRayMode(mode)
}

export const toggleSidebar = () => {
  const store = usePhotoStore()
  store.toggleSidebar()
}

export const setTargetImage = (imageId: string | null) => {
  const store = usePhotoStore()
  store.setTargetImage(imageId)
}
