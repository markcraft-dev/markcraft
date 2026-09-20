<template>
  <!-- Dim + blur the page behind the tour so the bubble stands out; click = skip -->
  <div
    class="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
    aria-hidden="true"
    @click="$emit('skip')"
  ></div>
  <!-- Highlight ring around the anchored target: above the mask, never interactive -->
  <div
    v-if="anchor"
    class="fixed z-50 pointer-events-none rounded-xl tour-ring"
    :style="ringStyle"
    aria-hidden="true"
  ></div>
  <div
    class="fixed z-50 w-[min(420px,90vw)] rounded-2xl border border-white/10 bg-[#18181b] text-white shadow-2xl p-16px select-none"
    :style="bubbleStyle"
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
import { isZhLang, type TourAnchorRect } from '../core/onboarding'

const props = withDefaults(
  defineProps<{
    step?: number
    total?: number
    title?: string
    body?: string
    shortcut?: string
    isFirst?: boolean
    isLast?: boolean
    /** Viewport-space target rect from App; null = bottom-center fallback. */
    anchor?: TourAnchorRect | null
  }>(),
  {
    step: 0,
    total: 1,
    title: '',
    body: '',
    shortcut: '',
    isFirst: true,
    isLast: true,
    anchor: null
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

const RING_PAD = 6
const GAP = 12
// Rough bubble height for the above/below flip decision (measured post-mount
// would be nicer; fixed estimate keeps this dependency-free and stable).
const EST_BUBBLE_H = 200

function viewportW(): number {
  try {
    return window.innerWidth || 1024
  } catch {
    return 1024
  }
}

function viewportH(): number {
  try {
    return window.innerHeight || 768
  } catch {
    return 768
  }
}

/** Bubble position: near the anchor with auto above/below flip + edge clamp. */
const bubbleStyle = computed<Record<string, string>>(() => {
  const a = props.anchor
  if (!a) {
    return { left: '50%', bottom: '70px', transform: 'translateX(-50%)' }
  }
  const vw = viewportW()
  const vh = viewportH()
  const w = Math.min(420, vw * 0.9)
  const cx = a.x + a.width / 2
  const left = Math.max(8, Math.min(cx - w / 2, vw - w - 8))
  const below = vh - (a.y + a.height)
  if (below >= EST_BUBBLE_H + GAP) {
    return { left: `${left}px`, top: `${a.y + a.height + GAP}px` }
  }
  return { left: `${left}px`, top: `${Math.max(8, a.y - EST_BUBBLE_H - GAP)}px` }
})

const ringStyle = computed<Record<string, string>>(() => {
  const a = props.anchor
  if (!a) return {}
  return {
    left: `${a.x - RING_PAD}px`,
    top: `${a.y - RING_PAD}px`,
    width: `${a.width + RING_PAD * 2}px`,
    height: `${a.height + RING_PAD * 2}px`
  }
})
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
.tour-ring {
  border: 2px solid var(--primary-color);
  box-shadow:
    0 0 0 4px color-mix(in srgb, var(--primary-color) 22%, transparent),
    0 0 22px color-mix(in srgb, var(--primary-color) 45%, transparent);
}
</style>
