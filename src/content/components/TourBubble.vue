<template>
  <!-- No target: legacy full mask; click = skip -->
  <div
    v-if="!anchor"
    class="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
    aria-hidden="true"
    @click="$emit('skip')"
  ></div>
  <!-- Anchored spotlight: shape-following SVG cutout so the target keeps its
    own corners (round IconButtons get a round hole, not a square halo).
    Clicks anywhere = skip. -->
  <template v-else>
    <!-- Blur layer: same hole punched via an SVG mask, so only the outside blurs -->
    <div
      class="fixed inset-0 z-40 backdrop-blur-[2px]"
      :style="blurMaskStyle"
      aria-hidden="true"
      @click="$emit('skip')"
    ></div>
    <!-- Dim layer: full-viewport path with an evenodd rounded-rect hole plus a
      2px primary stroke replacing the old div ring -->
    <svg
      class="fixed left-0 top-0 z-40"
      width="100%"
      height="100%"
      aria-hidden="true"
      @click="$emit('skip')"
    >
      <path :d="dimPath" fill="black" fill-opacity="0.5" fill-rule="evenodd" />
      <rect
        v-if="holeBox"
        :x="holeBox.x"
        :y="holeBox.y"
        :width="holeBox.w"
        :height="holeBox.h"
        :rx="holeBox.r"
        fill="none"
        stroke-width="2"
        style="stroke: var(--primary-color); filter: drop-shadow(0 0 6px var(--primary-color))"
      />
    </svg>
    <!-- Transparent skip-capture over the hole: the target stays visible but
      mid-tour clicks must not flip its state (same behavior as the mask). -->
    <div
      class="fixed z-40"
      :style="holeCaptureStyle"
      aria-hidden="true"
      @click="$emit('skip')"
    ></div>
  </template>
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
 * Spotlight hole: target rect expanded by RING_PAD, corner radius taken from
 * the target's own computed border-radius (unknown → 10px), clamped to half
 * the short side so pills and round buttons get matching holes.
 */
const holeBox = computed<HoleBox | null>(() => {
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

function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  return (
    `M${x + rr} ${y}` +
    `H${x + w - rr}Q${x + w} ${y} ${x + w} ${y + rr}` +
    `V${y + h - rr}Q${x + w} ${y + h} ${x + w - rr} ${y + h}` +
    `H${x + rr}Q${x} ${y + h} ${x} ${y + h - rr}` +
    `V${y + rr}Q${x} ${y} ${x + rr} ${y}Z`
  )
}

/** Dim path: full viewport with the rounded hole punched via evenodd. */
const dimPath = computed(() => {
  const b = holeBox.value
  if (!b) return ''
  return `M0 0H${viewportW()}V${viewportH()}H0Z ${roundedRectPath(b.x, b.y, b.w, b.h, b.r)}`
})

/**
 * Blur mask: same hole geometry as the dim path (single-sourced from holeBox).
 * The hole rect is fully transparent (fill-opacity 0, not just black): the
 * -webkit- mask dialect reads alpha while the standard one reads luminance,
 * so a merely black hole stays opaque under the prefixed prefix and the blur
 * would cover the target. Explicit size/position/repeat pin the data-URI
 * coordinates 1:1 to the viewport in both dialects.
 */
const blurMaskStyle = computed<Record<string, string>>(() => {
  const b = holeBox.value
  if (!b) return {}
  const vw = viewportW()
  const vh = viewportH()
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${vw}" height="${vh}" preserveAspectRatio="none">` +
    `<rect width="${vw}" height="${vh}" fill="white"/>` +
    `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${b.r}" fill="black" fill-opacity="0"/>` +
    `</svg>`
  const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  return {
    '-webkit-mask-image': url,
    'mask-image': url,
    '-webkit-mask-size': '100% 100%',
    'mask-size': '100% 100%',
    '-webkit-mask-position': '0 0',
    'mask-position': '0 0',
    '-webkit-mask-repeat': 'no-repeat',
    'mask-repeat': 'no-repeat'
  }
})

/** Transparent capture box over the hole (same rounded shape). */
const holeCaptureStyle = computed<Record<string, string>>(() => {
  const b = holeBox.value
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
</style>
