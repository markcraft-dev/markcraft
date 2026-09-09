<template>
  <transition name="fade">
    <div
      v-if="visible"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md select-none print:hidden"
      @click.self="$emit('close')"
    >
      <!-- Top Action Bar -->
      <div class="absolute top-16px right-20px flex items-center gap-10px z-50">
        <!-- Download Button -->
        <button
          class="flex items-center gap-6px py-7px px-14px rounded-full bg-white/10 hover:bg-white/20 text-white text-12px transition-colors cursor-pointer border-0 outline-none backdrop-blur-md"
          title="下载原图"
          @click="downloadImage"
        >
          <IconDownload class="w-4 h-4" />
          <span>下载图片</span>
        </button>

        <!-- Close Button -->
        <button
          class="w-34px h-34px flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer border-0 outline-none backdrop-blur-md"
          title="关闭 (Esc)"
          @click="$emit('close')"
        >
          <IconClose class="w-4 h-4" />
        </button>
      </div>

      <!-- Zoom Controls Bottom Bar -->
      <div class="absolute bottom-24px left-1/2 -translate-x-1/2 flex items-center gap-12px px-16px py-8px rounded-full bg-black/60 text-white text-12px backdrop-blur-md border border-white/10 z-50">
        <button class="hover:text-blue-400 cursor-pointer border-0 outline-none text-14px font-bold px-4px" @click="zoomOut">-</button>
        <span class="font-mono text-11px opacity-80 min-w-36px text-center">{{ Math.round(scale * 100) }}%</span>
        <button class="hover:text-blue-400 cursor-pointer border-0 outline-none text-14px font-bold px-4px" @click="zoomIn">+</button>
        <div class="w-1px h-12px bg-white/20"></div>
        <button class="hover:text-blue-400 cursor-pointer border-0 outline-none text-11px" @click="resetZoom">重置</button>
      </div>

      <!-- Main Image Preview Container -->
      <div class="max-w-[90vw] max-h-[85vh] flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing">
        <img
          :src="src"
          :alt="alt"
          class="max-w-full max-h-[85vh] object-contain transition-transform duration-150 rounded shadow-2xl"
          :style="{ transform: `scale(${scale})` }"
        />
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import IconDownload from '@/components/icons/IconDownload.vue'
import IconClose from '@/components/icons/IconClose.vue'

const props = defineProps<{
  visible: boolean
  src: string
  alt?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const scale = ref(1)

function zoomIn() {
  scale.value = Math.min(3, scale.value + 0.25)
}

function zoomOut() {
  scale.value = Math.max(0.25, scale.value - 0.25)
}

function resetZoom() {
  scale.value = 1
}

function downloadImage() {
  const a = document.createElement('a')
  a.href = props.src
  const filename = props.alt || props.src.split('/').pop()?.split('?')[0] || 'image.png'
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

function handleKeyDown(e: KeyboardEvent) {
  if (props.visible && e.key === 'Escape') {
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
