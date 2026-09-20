<template>
  <!-- Dim + blur the page behind the tour so the bubble stands out; click = skip -->
  <div
    class="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
    aria-hidden="true"
    @click="$emit('skip')"
  ></div>
  <div
    class="fixed bottom-70px left-1/2 -translate-x-1/2 z-50 w-[min(420px,90vw)] rounded-2xl border border-white/10 bg-[#18181b] text-white shadow-2xl p-16px select-none"
    role="dialog"
    aria-label="MarkCraft tour"
  >
    <div class="flex items-center justify-between mb-6px">
      <span class="text-12px font-semibold">{{ title }}</span>
      <span class="text-11px font-mono text-white/50">{{ step + 1 }} / {{ total }}</span>
    </div>
    <p class="text-12px leading-relaxed text-white/80 mb-10px">{{ body }}</p>
    <div class="flex items-center justify-between">
      <span v-if="shortcut" class="px-6px py-2px rounded bg-white/15 text-11px font-mono text-white/90">
        {{ shortcut }}
      </span>
      <span v-else></span>
      <div class="flex items-center gap-8px">
        <button
          v-if="!isFirst"
          class="tour-btn bg-transparent text-white/70 hover:text-white"
          @click="$emit('prev')"
        >
          {{ prevLabel }}
        </button>
        <button class="tour-btn bg-transparent text-white/70 hover:text-white" @click="$emit('skip')">
          {{ skipLabel }}
        </button>
        <button
          class="tour-btn px-10px py-4px rounded-lg bg-white text-[#18181b] font-semibold hover:opacity-90"
          @click="$emit('next')"
        >
          {{ isLast ? doneLabel : nextLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { isZhLang } from '../core/onboarding'

withDefaults(
  defineProps<{
    step?: number
    total?: number
    title?: string
    body?: string
    shortcut?: string
    isFirst?: boolean
    isLast?: boolean
  }>(),
  {
    step: 0,
    total: 1,
    title: '',
    body: '',
    shortcut: '',
    isFirst: true,
    isLast: true
  }
)

defineEmits<{
  (e: 'next'): void
  (e: 'prev'): void
  (e: 'skip'): void
}>()

const zh = isZhLang()
const prevLabel = computed(() => (zh ? '上一步' : 'Back'))
const nextLabel = computed(() => (zh ? '下一步' : 'Next'))
const skipLabel = computed(() => (zh ? '跳过' : 'Skip'))
const doneLabel = computed(() => (zh ? '完成' : 'Done'))
</script>

<style scoped>
.tour-btn {
  font-size: 12px;
  cursor: pointer;
  border: 0;
  outline: none;
  /* NOTE: no background declaration here — the scoped attribute selector
     outranks Tailwind's bg-white and previously turned the primary
     Next/Done button transparent (dark text on page = invisible). Ghost
     buttons carry an explicit bg-transparent utility instead. */
  transition: opacity 0.12s ease;
  white-space: nowrap;
}
</style>
