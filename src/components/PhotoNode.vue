<template>
  <div class="photo-node" :class="{ 'expanded': isExpanded }">
    <div class="photo-container">
      <img 
        :src="photo.url" 
        :alt="photo.title"
        @click="handlePhotoClick"
        class="photo-image"
        :class="{ 'selected': isSelected }"
      />
      
      <!-- 描述按钮 -->
      <button 
        @click="toggleDescription" 
        class="description-toggle"
        :class="{ 'active': isExpanded }"
        title="显示/隐藏描述"
      >
        {{ isExpanded ? '收起' : '描述' }}
      </button>
      
      <!-- 选择指示器 -->
      <div v-if="isSelected" class="selection-indicator">
        <span class="icon">✓</span>
      </div>
    </div>
    
    <!-- 图片名称和尺寸 -->
    <div class="photo-title">
      <span class="photo-name">{{ decodeUnicode(photo.original_filename) || photo.filename || photo.title || '未知' }}</span>
      <span class="photo-size">{{ photo.width && photo.height ? `${photo.width} × ${photo.height}` : '' }}</span>
    </div>
    
    <!-- 描述内容区域 -->
    <div class="description-container" :class="{ 'expanded': shouldShowDescription }">
      <div class="description-content">
        <!-- 元数据键值对展示 -->
        <div class="metadata-grid">
          <!-- 标签 -->
          <div class="metadata-item">
            <span class="metadata-key">标签:</span>
            <div class="metadata-tags">
              <span 
                v-for="tag in (photo.type_tags || photo.tags?.slice(0, 5) || [])" 
                :key="tag" 
                class="tag type-tag"
              >
                {{ tag }}
              </span>
              <span v-if="(!photo.type_tags || photo.type_tags.length === 0) && (!photo.tags || photo.tags.length === 0)" class="tag-more">
                无标签
              </span>
            </div>
          </div>
          
          <!-- 简介 -->
          <div class="metadata-item">
            <span class="metadata-key">简介:</span>
            <div class="metadata-tags">
              <span 
                v-for="tag in (photo.phrase_tags || []).slice(0, 3)" 
                :key="tag" 
                class="tag phrase-tag"
              >
                {{ tag }}
              </span>
              <span v-if="photo.phrase_tags && photo.phrase_tags.length > 3" class="tag-more">
                +{{ photo.phrase_tags.length - 3 }} 更多
              </span>
              <span v-if="!photo.phrase_tags || photo.phrase_tags.length === 0" class="tag-more">
                无标签
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Photo } from '../stores/photoStore'

interface Props {
  photo: Photo
  isSelected?: boolean
  globalDescriptionMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isSelected: false,
  globalDescriptionMode: false
})

const emit = defineEmits<{
  photoClick: [photo: Photo]
}>()

const isExpanded = ref(false)

// 计算是否应该显示描述（全局模式或本地展开）
const shouldShowDescription = computed(() => {
  return props.globalDescriptionMode || isExpanded.value
})

// 监听全局描述模式变化
watch(() => props.globalDescriptionMode, (newValue) => {
  if (newValue) {
    isExpanded.value = true
  } else {
    isExpanded.value = false
  }
})

const toggleDescription = () => {
  isExpanded.value = !isExpanded.value
}

const handlePhotoClick = () => {
  emit('photoClick', props.photo)
}

// Unicode解码函数
const decodeUnicode = (str: string | undefined): string => {
  if (!str) return ''
  return str.replace(/U([0-9A-Fa-f]{4})/g, (_, code) => {
    return String.fromCharCode(parseInt(code, 16))
  })
}
</script>

<style scoped>
.photo-node {
  position: relative;
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  cursor: pointer;
}

.photo-node:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.photo-container {
  position: relative;
  overflow: hidden;
}

.photo-image {
  width: 100%;
  height: auto;
  display: block;
  transition: transform 0.3s ease;
}

.photo-image:hover {
  transform: scale(1.05);
}

.photo-image.selected {
  border: 3px solid #4CAF50;
}

.photo-title {
  padding: 12px 16px 8px;
  font-size: 14px;
  font-weight: 500;
  color: #333;
  line-height: 1.4;
  background: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.photo-name {
  flex: 1;
}

.photo-size {
  font-size: 12px;
  color: #666;
  font-weight: 400;
}

/* 描述按钮 */
.description-toggle {
  position: absolute;
  top: 12px;
  right: 12px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(10px);
  z-index: 10;
}

.description-toggle:hover {
  background: rgba(0, 0, 0, 0.8);
  transform: scale(1.05);
}

.description-toggle.active {
  background: #4CAF50;
}

/* 选择指示器 */
.selection-indicator {
  position: absolute;
  top: 12px;
  left: 12px;
  background: #4CAF50;
  color: white;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: bold;
  z-index: 10;
}

/* 描述内容区域 */
.description-container {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;
  background: #f8f9fa;
  border-top: 1px solid #e9ecef;
}

.description-container.expanded {
  max-height: 300px;
}

.description-content {
  padding: 16px;
}

/* 元数据网格 */
.metadata-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.metadata-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 14px;
  line-height: 1.4;
  margin-bottom: 3px;
}

.metadata-key {
  font-weight: 600;
  color: #333;
  min-width: 40px;
  flex-shrink: 0;
  font-size: 14px;
}

.metadata-value {
  color: #333;
  flex: 1;
  word-break: break-word;
  font-size: 14px;
}

.metadata-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  flex: 1;
}

.tag {
  color: #333;
  padding: 2px 4px;
  font-size: 14px;
  font-weight: 500;
}

/* 不同类型的标签样式 */
.type-tag {
  color: #333;
}

.phrase-tag {
  color: #333;
}

.tag-more {
  color: #333;
  font-style: italic;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .photo-title {
    padding: 10px 12px 6px;
    font-size: 13px;
  }
  
  .description-content {
    padding: 12px;
  }
  
  .description-toggle {
    padding: 4px 10px;
    font-size: 11px;
  }
}
</style>
