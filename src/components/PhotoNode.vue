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
    
    <!-- 图片标题 -->
    <div class="photo-title">{{ photo.title }}</div>
    
    <!-- 描述内容区域 -->
    <div class="description-container" :class="{ 'expanded': shouldShowDescription }">
      <div class="description-content">
        <!-- 元数据键值对展示 -->
        <div class="metadata-grid">
          <div class="metadata-item">
            <span class="metadata-key">标题:</span>
            <span class="metadata-value">{{ photo.title }}</span>
          </div>
          
          <div class="metadata-item">
            <span class="metadata-key">描述:</span>
            <span class="metadata-value">{{ photo.description }}</span>
          </div>
          
          <div class="metadata-item">
            <span class="metadata-key">日期:</span>
            <span class="metadata-value">{{ photo.date }}</span>
          </div>
          
          <div class="metadata-item" v-if="photo.width && photo.height">
            <span class="metadata-key">尺寸:</span>
            <span class="metadata-value">{{ photo.width }} × {{ photo.height }}</span>
          </div>
          
          <div class="metadata-item" v-if="photo.format">
            <span class="metadata-key">格式:</span>
            <span class="metadata-value">{{ photo.format }}</span>
          </div>
          
          <div class="metadata-item" v-if="photo.source_website">
            <span class="metadata-key">来源:</span>
            <span class="metadata-value">{{ photo.source_website }}</span>
          </div>
          
          <div class="metadata-item" v-if="photo.tags && photo.tags.length > 0">
            <span class="metadata-key">标签:</span>
            <div class="metadata-tags">
              <span 
                v-for="tag in photo.tags" 
                :key="tag" 
                class="tag"
              >
                {{ tag }}
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
  font-size: 13px;
  line-height: 1.4;
}

.metadata-key {
  font-weight: 600;
  color: #333;
  min-width: 60px;
  flex-shrink: 0;
}

.metadata-value {
  color: #555;
  flex: 1;
  word-break: break-word;
}

.metadata-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  flex: 1;
}

.tag {
  background: #e3f2fd;
  color: #1976d2;
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 500;
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
