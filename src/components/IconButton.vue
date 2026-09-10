<template>
  <div class="relative inline-flex group/btn" @mouseenter="isHovered = true" @mouseleave="isHovered = false">
    <button
      class="icon-btn p-6px rounded-lg transition-colors cursor-pointer border-0 outline-none flex items-center justify-center select-none"
      :class="[
        active
          ? 'text-[--primary-color] bg-[--primary-light] font-semibold'
          : disabled
          ? 'text-[--text-muted] opacity-40 cursor-not-allowed'
          : 'text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-hover]'
      ]"
      :title="title || undefined"
      :aria-label="title || undefined"
      :disabled="disabled"
      @click="$emit('click', $event)"
    >
      <slot />
    </button>

    <!-- extension black pill Floating Tooltip (Screenshot 1 & 4) -->
    <transition name="tip-fade">
      <div
        v-if="isHovered && title && !disabled"
        class="absolute z-50 pointer-events-none flex items-center gap-6px px-8px py-4px rounded-lg bg-[#18181b] text-white text-12px font-medium shadow-xl border border-white/10 whitespace-nowrap"
        :class="placement === 'top' ? 'bottom-full mb-6px left-1/2 -translate-x-1/2' : 'top-full mt-6px left-1/2 -translate-x-1/2'"
      >
        <span>{{ title }}</span>
        <span v-if="shortcut" class="px-5px py-1px rounded bg-white/15 text-10px font-mono text-white/90">
          {{ shortcut }}
        </span>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

withDefaults(
  defineProps<{
    title?: string
    shortcut?: string
    active?: boolean
    disabled?: boolean
    placement?: 'bottom' | 'top'
  }>(),
  {
    title: '',
    shortcut: '',
    active: false,
    disabled: false,
    placement: 'bottom'
  }
)

defineEmits<{
  (e: 'click', evt: MouseEvent): void
}>()

const isHovered = ref(false)
</script>

<style scoped>
.tip-fade-enter-active,
.tip-fade-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.tip-fade-enter-from,
.tip-fade-leave-to {
  opacity: 0;
  transform: scale(0.95) translate(-50%, 0);
}
</style>
