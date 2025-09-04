<template>
  <div 
    class="sidebar"
    :class="{ open: isSidebarOpen }"
  >
    <div class="sidebar-header">
      <h3>照片列表</h3>
      <button @click="closeSidebar" class="close-btn">×</button>
    </div>
    
    <div class="sidebar-content">
      <div class="photo-list">
        <div
          v-for="photo in images"
          :key="photo.id"
          class="photo-item"
          :class="{ 
            selected: targetImage === photo.id,
            highlighted: highlightNodes.includes(photo.id)
          }"
          @click="selectPhoto(photo)"
        >
          <div class="photo-thumbnail">
            <img :src="photo.url" :alt="photo.title" />
          </div>
          <div class="photo-details">
            <h4>{{ photo.title }}</h4>
            <p>{{ photo.description }}</p>
            <div class="photo-meta">
              <span class="date">{{ photo.date }}</span>
              <div class="tags">
                <span 
                  v-for="tag in photo.tags.slice(0, 2)" 
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
      
      <div v-if="!images.length" class="empty-state">
        <p>暂无照片</p>
        <p>请在搜索框中输入关键词来查找照片</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { usePhotoStore } from '../stores/photoStore'
import type { Photo } from '../stores/photoStore'

const store = usePhotoStore()

const isSidebarOpen = computed(() => store.isSidebarOpen)
const images = computed(() => store.images)
const targetImage = computed(() => store.targetImage)
const highlightNodes = computed(() => store.highlightNodes)

const selectPhoto = (photo: Photo) => {
  store.setTargetImage(photo.id)
}

const closeSidebar = () => {
  store.toggleSidebar()
}
</script>

<style scoped>
.sidebar {
  position: fixed;
  top: 0;
  right: -400px;
  width: 400px;
  height: 100vh;
  background: white;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
  transition: right 0.3s ease;
  z-index: 1000;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.sidebar.open {
  right: 0;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e0e0e0;
  background: #f8f9fa;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
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
  background: #e0e0e0;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.photo-list {
  padding: 0;
}

.photo-item {
  display: flex;
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
  transition: all 0.3s ease;
}

.photo-item:hover {
  background: #f8f9fa;
}

.photo-item.selected {
  background: #e3f2fd;
  border-left: 4px solid #2196f3;
}

.photo-item.highlighted {
  background: #fff3e0;
  border-left: 4px solid #ff9800;
}

.photo-thumbnail {
  width: 60px;
  height: 60px;
  margin-right: 16px;
  flex-shrink: 0;
}

.photo-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 8px;
}

.photo-details {
  flex: 1;
  min-width: 0;
}

.photo-details h4 {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.photo-details p {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #666;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.photo-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.date {
  font-size: 12px;
  color: #999;
}

.tags {
  display: flex;
  gap: 4px;
}

.tag {
  background: #e3f2fd;
  color: #1976d2;
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 500;
}

.empty-state {
  padding: 40px 20px;
  text-align: center;
  color: #666;
}

.empty-state p {
  margin: 8px 0;
  font-size: 14px;
}

.empty-state p:first-child {
  font-size: 16px;
  font-weight: 500;
  color: #333;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .sidebar {
    width: 100%;
    right: -100%;
  }
  
  .sidebar.open {
    right: 0;
  }
}
</style>

