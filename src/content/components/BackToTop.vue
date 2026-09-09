<template>
  <transition name="fade">
    <button
      v-show="visible"
      class="back-to-top-btn fixed bottom-32px right-32px z-40 w-48px h-48px flex items-center justify-center rounded-full bg-[--bg-card] text-[--text-secondary] shadow-lg backdrop-blur-md hover:text-[--primary-color] transition-all cursor-pointer select-none print:hidden border-0 outline-none p-0 group"
      :title="`已阅读 ${progressPercent}% - 点击回到顶部`"
      @click="scrollToTop"
    >
      <!-- Circular Progress SVG Ring -->
      <svg class="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 48 48">
        <!-- Track Circle -->
        <circle
          cx="24"
          cy="24"
          r="20"
          stroke="currentColor"
          stroke-width="2.5"
          fill="transparent"
          class="text-[--border-color] opacity-60"
        />
        <!-- Progress Circle -->
        <circle
          cx="24"
          cy="24"
          r="20"
          stroke="var(--primary-color)"
          stroke-width="2.8"
          fill="transparent"
          stroke-linecap="round"
          :stroke-dasharray="circumference"
          :stroke-dashoffset="dashOffset"
          class="transition-[stroke-dashoffset] duration-100 ease-out"
        />
      </svg>

      <!-- Center Arrow Icon -->
      <SvgIcon name="arrow-up" class="w-5 h-5 text-[--text-secondary] group-hover:text-[--primary-color] transition-colors relative z-10"  />
    </button>
  </transition>
</template>

<script setup lang="ts">
import SvgIcon from '@/components/SvgIcon.vue'
import { ref, computed, onMounted, onUnmounted } from 'vue'

const visible = ref(false)
const progress = ref(0)
const radius = 20
const circumference = 2 * Math.PI * radius // ≈ 125.66

const dashOffset = computed(() => {
  const p = Math.min(100, Math.max(0, progress.value))
  return circumference - (circumference * p) / 100
})

const progressPercent = computed(() => Math.round(progress.value))

function checkScroll() {
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0
  const docHeight = document.documentElement.scrollHeight - window.innerHeight

  if (docHeight > 0) {
    progress.value = (scrollTop / docHeight) * 100
  } else {
    progress.value = 0
  }

  visible.value = scrollTop > 200
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  window.addEventListener('scroll', checkScroll, { passive: true })
  checkScroll()
})

onUnmounted(() => {
  window.removeEventListener('scroll', checkScroll)
})
</script>

<style scoped>
.back-to-top-btn {
  box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.12), 0 2px 6px -1px rgba(0, 0, 0, 0.08);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: scale(0.85);
}
</style>
