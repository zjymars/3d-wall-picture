<template>
  <div class="photo-viz-3d">
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
    
    <!-- Canvas容器 - 始终存在 -->
      <div class="canvas-container" ref="canvasContainer">
        <canvas ref="canvas"></canvas>
      </div>
    
    <!-- 正常内容 -->
    <div v-if="!isLoading && !error">
      
      <div class="controls-3d">
        <div class="control-group">
          <label>相机距离:</label>
          <input 
            type="range" 
            v-model="cameraDistance" 
            min="10" 
            max="100" 
            step="1"
          />
          <span>{{ cameraDistance }}</span>
        </div>
        
        <div class="control-group">
          <label>旋转速度:</label>
          <input 
            type="range" 
            v-model="rotationSpeed" 
            min="0" 
            max="0.02" 
            step="0.001"
          />
          <span>{{ (rotationSpeed * 1000).toFixed(1) }}</span>
        </div>
        
        <button @click="resetCamera" class="reset-btn">
          重置相机
        </button>
        
        <div class="help-text">
          <p>🖱️ 滚轮: 缩放</p>
          <p>🖱️ 左键拖拽: 旋转</p>
          <p>🖱️ 双击图片: 查看详情</p>
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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue'
import * as THREE from 'three'
import { usePhotoStore } from '../stores/photoStore'

const store = usePhotoStore()
const canvasContainer = ref<HTMLDivElement>()
const canvas = ref<HTMLCanvasElement>()

// 3D 场景相关
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let group: THREE.Group
let photoMeshes: THREE.Mesh[] = []

// 纹理缓存，避免重复加载
const textureCache = new Map<string, THREE.Texture>()


// 控制参数
const cameraDistance = ref(25)
const rotationSpeed = ref(0.0025) // 降低初始旋转速度为50%
let isAutoRotating = ref(true)
let animationId: number

// 选中的照片
const selectedPhoto = ref<any>(null)

// 旋转暂停相关
let rotationPauseTimer: number | null = null
const ROTATION_PAUSE_DURATION = 1000 // 1秒后恢复旋转（用于单击/拖拽）
const DETAIL_PANEL_RESUME_DELAY = 500 // 0.5秒后恢复旋转（用于关闭详情面板）

// 状态管理
let isDetailPanelOpen = false // 跟踪详情面板是否打开

// 鼠标控制相关
let isMouseDown = false
let previousMouseX = 0
let previousMouseY = 0
let targetRotationX = 0
let targetRotationY = 0

// 计算属性
const images = computed(() => store.images)
const xRayMode = computed(() => store.xRayMode)
const isLoading = computed(() => store.isLoading)
const error = computed(() => store.error)

// 初始化 3D 场景
const initScene = async () => {
  if (!canvas.value) {
    console.error('❌ [3D初始化] Canvas元素未找到')
    return
  }
  
  console.log('🎬 [3D初始化] 开始初始化3D场景...')
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a1a1a)
  
  const aspect = canvasContainer.value!.clientWidth / canvasContainer.value!.clientHeight
  camera = new THREE.PerspectiveCamera(85, aspect, 0.1, 1000) // 增加视野角度，让球体更好地填充屏幕
  camera.position.set(0, -2, cameraDistance.value) // 降低相机Y位置，减少上方空余
  
  renderer = new THREE.WebGLRenderer({ 
    canvas: canvas.value, 
    antialias: true,
    alpha: true 
  })
  renderer.setSize(canvasContainer.value!.clientWidth, canvasContainer.value!.clientHeight)
  renderer.setPixelRatio(window.devicePixelRatio)
  
  group = new THREE.Group()
  group.position.y = -1 // 将整个球体组向下偏移1个单位，减少上方空余
  scene.add(group)
  
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambientLight)
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
  directionalLight.position.set(10, 10, 5)
  scene.add(directionalLight)
  
  console.log('✅ [3D初始化] 3D场景初始化完成')
  
  // 启动动画循环
  animate()
  console.log('🎬 [3D初始化] 动画循环已启动')
  
  // 如果有图片数据，创建网格
  if (images.value.length > 0) {
    console.log(`🖼️ [3D初始化] 检测到 ${images.value.length} 张图片，开始创建网格`)
    await createPhotoMeshes()
  } else {
    console.log('ℹ️ [3D初始化] 暂无图片数据，等待图片加载...')
  }
}

// 创建照片网格 - 优化版本：先创建模型，后加载纹理
const createPhotoMeshes = async () => {
  console.log('🎨 [3D渲染] createPhotoMeshes 被调用')
  
  // 安全检查：确保3D场景已经初始化
  if (!camera || !group || !scene) {
    console.warn('3D场景尚未初始化，跳过创建照片网格')
    return
  }
  
  // 清理现有的照片网格
  console.log(`🧹 [3D渲染] 清理现有网格，当前数量: ${photoMeshes.length}`)
  
  photoMeshes.forEach(mesh => {
    group.remove(mesh)
    mesh.geometry.dispose()
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach(mat => mat.dispose())
    } else {
    mesh.material.dispose()
    }
  })
  photoMeshes = []
  
  if (!images.value.length) {
    console.warn('⚠️ [3D渲染] 没有图片数据，跳过创建网格')
    return
  }
  
  console.log(`🎨 [3D渲染] 开始创建 ${images.value.length} 张图片的3D网格`)
  
  const displayImages = images.value
  const count = displayImages.length
  const radius = Math.min(15, Math.sqrt(count) * 2)
  
  console.log(`📐 [3D渲染] 图片数量: ${count}, 球体半径: ${radius}`)
  
  // 第一步：立即创建带有占位符纹理的模型
  console.log('🚀 [3D渲染] 第一步：创建占位符模型...')
    const geometry = new THREE.PlaneGeometry(1.5, 1.5)
    
  // 创建占位符纹理
  const placeholderTexture = new THREE.TextureLoader().load('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzMzMzMzMyIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE0IiBmaWxsPSIjNjY2NjY2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+5Yqg6L295LitLi4uPC90ZXh0Pjwvc3ZnPg==')
  placeholderTexture.generateMipmaps = false
  placeholderTexture.minFilter = THREE.LinearFilter
  placeholderTexture.magFilter = THREE.LinearFilter
  
  // 立即创建所有模型，使用占位符纹理
  displayImages.forEach((photo, index) => {
    const material = new THREE.MeshLambertMaterial({ 
      map: placeholderTexture,
      transparent: true,
      opacity: xRayMode.value ? 0.8 : 1.0
    })
    
    const mesh = new THREE.Mesh(geometry, material)
    
    // 球形分布算法
      const phi = Math.acos(-1 + (2 * index) / count)
      const theta = Math.sqrt(count * Math.PI) * phi
      
      mesh.position.x = radius * Math.cos(theta) * Math.sin(phi)
      mesh.position.y = radius * Math.sin(theta) * Math.sin(phi)
      mesh.position.z = radius * Math.cos(phi)
      
    // 让模型面向相机
      if (camera && camera.position) {
        mesh.lookAt(camera.position)
      }
      
      mesh.userData = { 
        photoId: photo.id,
      photoUrl: photo.url,
        onClick: () => {
          store.setTargetImage(photo.id)
        }
      }
      
      group.add(mesh)
      photoMeshes.push(mesh)
  })
  
  console.log(`✅ [3D渲染] 占位符模型创建完成，开始异步加载纹理...`)
  
  // 第二步：异步加载真实纹理并替换占位符
  loadTexturesAsync(displayImages)
}

// 异步加载纹理并替换占位符
const loadTexturesAsync = async (displayImages: any[]) => {
  console.log(`🖼️ [3D渲染] 开始异步加载 ${displayImages.length} 张图片纹理...`)
  
  const loadTexture = (photo: any, index: number) => {
    return new Promise<THREE.Texture>((resolve, reject) => {
      // 检查缓存
      if (textureCache.has(photo.url)) {
        resolve(textureCache.get(photo.url)!)
        return
      }
      
      const textureLoader = new THREE.TextureLoader()
      textureLoader.load(
        photo.url,
        (texture) => {
          // 优化纹理设置
          texture.generateMipmaps = false
          texture.minFilter = THREE.LinearFilter
          texture.magFilter = THREE.LinearFilter
          texture.format = THREE.RGBAFormat
          texture.flipY = true
          
          // 缓存纹理
          textureCache.set(photo.url, texture)
          
          // 立即替换对应模型的纹理
          if (photoMeshes[index]) {
            const material = photoMeshes[index].material as THREE.MeshLambertMaterial
            material.map = texture
            material.needsUpdate = true
            console.log(`🔄 [3D渲染] 已替换第 ${index + 1} 张图片纹理`)
          }
          
          resolve(texture)
        },
        undefined,
        (error) => {
          console.warn(`⚠️ [3D渲染] 第 ${index + 1} 张图片加载失败:`, error)
          reject(error)
        }
      )
    })
  }
  
  // 批量加载纹理，每批10张
  const batchSize = 10
  for (let i = 0; i < displayImages.length; i += batchSize) {
    const batch = displayImages.slice(i, i + batchSize)
    const batchPromises = batch.map((photo, batchIndex) => 
      loadTexture(photo, i + batchIndex)
    )
    
    try {
      await Promise.all(batchPromises)
      console.log(`📦 [3D渲染] 批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(displayImages.length / batchSize)} 加载完成`)
    } catch (error) {
      console.warn(`⚠️ [3D渲染] 批次 ${Math.floor(i / batchSize) + 1} 部分加载失败:`, error)
    }
    
    // 短暂延迟，避免阻塞UI
    if (i + batchSize < displayImages.length) {
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  }
  
  console.log(`✅ [3D渲染] 所有纹理加载完成！`)
}

// 动画循环
const animate = () => {
  animationId = requestAnimationFrame(animate)
  
  // 安全检查：确保3D场景已经初始化
  if (!group || !camera || !renderer || !scene) {
    console.warn('⚠️ [动画循环] 3D场景对象缺失，跳过渲染')
    return
  }
  
  // 检查图片网格是否存在
  if (!photoMeshes.length) {
    console.warn('⚠️ [动画循环] 没有图片网格，跳过渲染')
    return
  }
  
  // 检查组中是否还有子对象
  if (group.children.length === 0) {
    console.warn('⚠️ [动画循环] 组中没有子对象，跳过渲染')
    return
  }
  
  if (isMouseDown) {
    isAutoRotating.value = false
    group.rotation.x += (targetRotationX - group.rotation.x) * 0.1
    group.rotation.y += (targetRotationY - group.rotation.y) * 0.1
  } else if (isAutoRotating.value) {
    group.rotation.y += rotationSpeed.value
  }
  
  // 让所有网格面向相机
  photoMeshes.forEach(mesh => {
      mesh.lookAt(camera.position)
    })
  
  renderer.render(scene, camera)
}

// 重置相机
const resetCamera = () => {
  if (!camera || !group) {
    console.warn('相机或场景组未初始化，无法重置')
    return
  }
  
  camera.position.set(0, -2, cameraDistance.value)
  group.rotation.set(0, 0, 0)
  targetRotationX = 0
  targetRotationY = 0
  isAutoRotating.value = true
}

// 重试加载
const retryLoad = async () => {
  try {
    await store.loadImagesFromLocal()
  } catch (error) {
    console.error('重试加载失败:', error)
  }
}

// 处理窗口大小变化
const handleResize = () => {
  if (!canvasContainer.value || !renderer || !camera) return
  
  const width = canvasContainer.value.clientWidth
  const height = canvasContainer.value.clientHeight
  
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  
  renderer.setSize(width, height)
}

// 鼠标滚轮缩放
const handleWheel = (event: WheelEvent) => {
  const delta = event.deltaY > 0 ? 1 : -1
  cameraDistance.value = Math.max(10, Math.min(100, cameraDistance.value + delta * 2))
  camera.position.set(0, -2, cameraDistance.value)
}

// 鼠标按下
const handleMouseDown = (event: MouseEvent) => {
  // 如果详情面板打开，不处理鼠标事件
  if (isDetailPanelOpen) {
    return
  }
  
  isMouseDown = true
  previousMouseX = event.clientX
  previousMouseY = event.clientY
  
  // 暂停自动旋转
  pauseAutoRotation()
  
  event.preventDefault()
}

// 鼠标移动
const handleMouseMove = (event: MouseEvent) => {
  if (!isMouseDown || isDetailPanelOpen) return
  
  const deltaX = event.clientX - previousMouseX
  const deltaY = event.clientY - previousMouseY
  
  targetRotationY += deltaX * 0.01
  targetRotationX += deltaY * 0.01
  
  previousMouseX = event.clientX
  previousMouseY = event.clientY
}

// 鼠标松开
const handleMouseUp = () => {
  if (isDetailPanelOpen) return
  
  isMouseDown = false
  // 延迟恢复自动旋转
  scheduleAutoRotationResume()
}

// 双击事件处理
const handleDoubleClick = (event: MouseEvent) => {
  console.log('🖱️ [双击事件] 检测到双击事件')
  
  // 如果详情面板已经打开，忽略双击
  if (isDetailPanelOpen) {
    console.log('🖱️ [双击事件] 详情面板已打开，忽略双击')
    return
  }
  
  // 获取点击位置
  const rect = canvas.value!.getBoundingClientRect()
  const mouse = new THREE.Vector2()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

  // 创建射线投射器
  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(mouse, camera)

  // 检测与照片网格的交集
  const intersects = raycaster.intersectObjects(photoMeshes)
  
  if (intersects.length > 0) {
    const clickedMesh = intersects[0].object
    const photoData = clickedMesh.userData
    
    if (photoData && photoData.photoId) {
      // 找到对应的照片数据
      const photo = images.value.find(p => p.id === photoData.photoId)
      if (photo) {
        console.log('🖱️ [双击事件] 选中照片:', photo.title)
        // 立即暂停旋转并清除所有定时器
        pauseAutoRotation()
        // 设置详情面板状态
        isDetailPanelOpen = true
        // 设置选中的照片
        selectedPhoto.value = photo
      }
    }
  }
}

// 鼠标离开
const handleMouseLeave = () => {
  if (isDetailPanelOpen) return
  
  isMouseDown = false
  // 确保鼠标离开时也恢复自动旋转
  scheduleAutoRotationResume()
}

// 暂停自动旋转
const pauseAutoRotation = () => {
  console.log('⏸️ [暂停旋转] 暂停自动旋转，当前状态:', isAutoRotating.value)
  isAutoRotating.value = false
  // 清除之前的定时器
  if (rotationPauseTimer) {
    clearTimeout(rotationPauseTimer)
    rotationPauseTimer = null
    console.log('⏸️ [暂停旋转] 清除了之前的恢复定时器')
  }
  console.log('⏸️ [暂停旋转] 旋转已暂停，定时器已清除')
}

// 安排自动旋转恢复
const scheduleAutoRotationResume = (delay: number = ROTATION_PAUSE_DURATION) => {
  console.log('⏰ [安排恢复] 安排自动旋转恢复，当前状态:', isAutoRotating.value, '延迟:', delay, 'ms')
  
  // 清除之前的定时器
  if (rotationPauseTimer) {
    clearTimeout(rotationPauseTimer)
    console.log('⏰ [安排恢复] 清除了之前的定时器')
  }
  
  // 设置新的定时器
  rotationPauseTimer = window.setTimeout(() => {
    isAutoRotating.value = true
    rotationPauseTimer = null
    console.log('🔄 [自动恢复] 自动旋转已恢复')
  }, delay)
  
  console.log('⏰ [安排恢复] 已设置新的恢复定时器，将在', delay, 'ms后恢复')
}

// 关闭详情面板
const closeDetailPanel = () => {
  console.log('❌ [关闭面板] 关闭详情面板')
  // 重置状态
  isDetailPanelOpen = false
  selectedPhoto.value = null
  // 关闭面板后延迟0.5秒恢复自动旋转
  scheduleAutoRotationResume(DETAIL_PANEL_RESUME_DELAY)
}

// 监听器
watch(cameraDistance, (newDistance) => {
  if (camera) {
    camera.position.set(0, -2, newDistance)
  }
})

watch(images, async (newImages, oldImages) => {
  console.log(`🔄 [图片监听] 图片数量变化: ${oldImages?.length || 0} -> ${newImages?.length || 0}`)
  
  // 检查3D场景是否已经初始化
  if (!camera || !group || !scene) {
    console.warn('⚠️ [图片监听] 3D场景未初始化，跳过网格创建')
      return
    }
    
  // 如果有新图片且场景已初始化，创建网格
  if (newImages && newImages.length > 0) {
    console.log(`🎨 [图片监听] 开始创建 ${newImages.length} 张图片的3D网格`)
    await createPhotoMeshes()
  }
}, { deep: true })

watch(xRayMode, (mode) => {
  photoMeshes.forEach(mesh => {
    const material = mesh.material as THREE.MeshLambertMaterial
    material.opacity = mode ? 0.8 : 1.0
  })
})

// 监听旋转速度变化，修复矩阵状态问题
watch(rotationSpeed, (newSpeed) => {
  console.log(`🔄 [旋转速度] 旋转速度变化: ${newSpeed}`)
  
  // 检查3D场景是否已经初始化
  if (!group || !camera || !renderer || !scene) {
    console.warn('⚠️ [旋转速度] 3D场景未初始化，跳过处理')
    return
  }
  
  // 检查图片网格是否存在
  if (!photoMeshes.length) {
    console.warn('⚠️ [旋转速度] 没有图片网格，跳过处理')
    return
  }
  
  // 检查组中是否还有子对象
  if (group.children.length === 0) {
    console.warn('⚠️ [旋转速度] 组中没有子对象，跳过处理')
    return
  }
  
  // 强制更新矩阵
  group.updateMatrix()
  group.updateMatrixWorld()
  
  // 强制渲染
  if (renderer && scene && camera) {
    console.log(`🎨 [旋转速度] 强制重新渲染...`)
    renderer.render(scene, camera)
  }
})

// 监听选中照片变化，控制旋转暂停
watch(selectedPhoto, (newPhoto, oldPhoto) => {
  console.log('🔄 [监听器] selectedPhoto变化:', { 
    newPhoto: newPhoto ? newPhoto.title : null, 
    oldPhoto: oldPhoto ? oldPhoto.title : null,
    isAutoRotating: isAutoRotating.value,
    isDetailPanelOpen: isDetailPanelOpen
  })
  
  // 注意：旋转控制现在主要在双击事件和关闭面板函数中处理
  // 这里只做状态同步，避免重复处理
}, { immediate: true })

// 生命周期
onMounted(() => {
  console.log('🚀 [组件挂载] PhotoViz3D组件已挂载')
  
  // 使用nextTick确保DOM元素已经渲染
  nextTick(async () => {
    console.log('⏰ [DOM就绪] DOM元素已就绪，开始初始化3D场景')
    await initScene()
  })
  
  window.addEventListener('resize', handleResize)
  if (canvas.value) {
    canvas.value.addEventListener('wheel', handleWheel, { passive: false })
    canvas.value.addEventListener('mousedown', handleMouseDown)
    canvas.value.addEventListener('mousemove', handleMouseMove)
    canvas.value.addEventListener('mouseup', handleMouseUp)
    canvas.value.addEventListener('mouseleave', handleMouseLeave)
    canvas.value.addEventListener('dblclick', handleDoubleClick)
  }
})

onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
  
  window.removeEventListener('resize', handleResize)
  if (canvas.value) {
    canvas.value.removeEventListener('wheel', handleWheel)
    canvas.value.removeEventListener('mousedown', handleMouseDown)
    canvas.value.removeEventListener('mousemove', handleMouseMove)
    canvas.value.removeEventListener('mouseup', handleMouseUp)
    canvas.value.removeEventListener('mouseleave', handleMouseLeave)
    canvas.value.removeEventListener('dblclick', handleDoubleClick)
  }
  
  // 清理旋转暂停定时器
  if (rotationPauseTimer) {
    clearTimeout(rotationPauseTimer)
    rotationPauseTimer = null
  }
  
  // 清理3D资源
  if (renderer) {
    renderer.dispose()
  }
})


const handleSelectPhoto = () => {
  if (selectedPhoto.value) {
    window.parent.postMessage({
      imageId: selectedPhoto.value.id
    }, '*')
  }
}
</script>

<style scoped>
.photo-viz-3d {
  position: relative;
  width: 100%;
  height: 100vh;
  background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
}

.canvas-container {
  width: 100%;
  height: 100%;
  position: relative;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: grab;
}

canvas:active {
  cursor: grabbing;
}

.controls-3d {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.8);
  padding: 20px;
  border-radius: 12px;
  color: white;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  max-width: 250px;
}

.control-group {
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.control-group label {
  font-size: 14px;
  font-weight: 500;
}

.control-group input[type="range"] {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.control-group input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  background: #4CAF50;
  border-radius: 50%;
  cursor: pointer;
}

.control-group span {
  font-size: 12px;
  opacity: 0.7;
}

.reset-btn {
  background: #4CAF50;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.3s ease;
  width: 100%;
  margin-bottom: 16px;
}

.reset-btn:hover {
  background: #45a049;
}

.help-text {
  font-size: 12px;
  opacity: 0.8;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  padding-top: 16px;
}

.help-text p {
  margin: 4px 0;
  font-size: 11px;
}

/* 加载状态样式 */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(26, 26, 26, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.loading-content {
  text-align: center;
  color: white;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(255, 255, 255, 0.3);
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
  opacity: 0.8;
}

/* 错误状态样式 */
.error-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(26, 26, 26, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.error-content {
  text-align: center;
  color: white;
  max-width: 400px;
  padding: 20px;
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
  opacity: 0.8;
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

/* 照片详情面板样式 */
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
</style>
