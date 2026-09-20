<template>
  <!-- Single full-screen mask UNDER the chrome (z-20): header/sidebars sit at
    z-30/z-40 so every tour target stays crisp, while the z-less main content
    dims + blurs. Misalignment-proof by construction — no holes to align.
    Click = skip, uniformly. -->
  <div
    class="fixed inset-0 z-20 bg-black/50 backdrop-blur-[2px]"
    aria-hidden="true"
    @click="$emit('skip')"
  ></div>
  <!-- Highlight ring around the anchored target (z-50, never interactive) -->
  <div
    v-if="ringBox"
    class="fixed z-50 pointer-events-none tour-ring"
    :style="ringBoxStyle"
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

/** Bubble position: four-side max-space placement that never covers the target. */
const bubbleStyle = computed<Record<string, string>>(() => {
  const a = props.anchor
  if (!a) {
    return { left: '50%', bottom: '70px', transform: 'translateX(-50%)' }
  }
  const vw = viewportW()
  const vh = viewportH()
  const M = 8
  const w = Math.min(420, vw * 0.9)
  const h = EST_BUBBLE_H
  // Hole outer box (ring included) so the bubble clears the stroke, not just the target.
  const hx0 = a.x - RING_PAD
  const hy0 = a.y - RING_PAD
  const hx1 = a.x + a.width + RING_PAD
  const hy1 = a.y + a.height + RING_PAD
  const space = {
    below: vh - hy1,
    above: hy0,
    right: vw - hx1,
    left: hx0
  }
  const fits = {
    below: space.below >= h + GAP,
    above: space.above >= h + GAP,
    right: space.right >= w + GAP,
    left: space.left >= w + GAP
  }
  // Max space wins; ties prefer left (right-edge targets open leftward),
  // then below, above, right.
  type Side = 'below' | 'above' | 'left' | 'right'
  const order: Side[] = ['left', 'below', 'above', 'right']
  const fitting = order.filter((s) => fits[s])
  let side: Side
  if (fitting.length > 0) {
    const best = Math.max(...fitting.map((s) => space[s]))
    side = fitting.find((s) => space[s] === best) ?? 'below'
  } else {
    // Nothing fits outright (tiny viewport): still take the roomiest side.
    side = order.reduce((best, s) => (space[s] > space[best] ? s : best))
  }
  const clampX = (x: number) => Math.max(M, Math.min(x, vw - w - M))
  if (side === 'below') {
    const cx = a.x + a.width / 2
    return { left: `${clampX(cx - w / 2)}px`, top: `${hy1 + GAP}px` }
  }
  if (side === 'above') {
    const cx = a.x + a.width / 2
    return { left: `${clampX(cx - w / 2)}px`, top: `${Math.max(M, hy0 - GAP - h)}px` }
  }
  const cy = a.y + a.height / 2
  const top = Math.max(M, Math.min(cy - h / 2, vh - h - M))
  if (side === 'right') {
    return { left: `${Math.max(M, Math.min(hx1 + GAP, vw - w - M))}px`, top: `${top}px` }
  }
  return { left: `${Math.max(M, hx0 - GAP - w)}px`, top: `${top}px` }
})

interface HoleBox {
  x: number
  y: number
  w: number
  h: number
  r: number
}

/**
 * Ring geometry only (T27): the mask holes are gone — layering keeps targets
 * crisp instead. Still follows the target's own corner radius so round
 * buttons get a round ring.
 */
const ringBox = computed<HoleBox | null>(() => {
  const a = props.anchor
  if (!a) return null
  const w = a.width + RING_PAD * 2
  const h = a.height + RING_PAD * 2
  const baseR = a.radius ?? 10
  return {
    x: a.x - RING_PAD,
    y: a.y - RING_PAD,
    w,
    h,
    r: Math.max(0, Math.min(baseR, w / 2, h / 2))
  }
})

const ringBoxStyle = computed<Record<string, string>>(() => {
  const b = ringBox.value
  if (!b) return {}
  return {
    left: `${b.x}px`,
    top: `${b.y}px`,
    width: `${b.w}px`,
    height: `${b.h}px`,
    borderRadius: `${b.r}px`
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
