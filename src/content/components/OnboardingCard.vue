<template>
  <div class="flex flex-col items-start p-16px text-left text-12px leading-relaxed text-[--text-secondary]">
    <div class="flex items-center gap-8px mb-8px">
      <SvgIcon name="folder" class="w-6 h-6 opacity-40 text-[--text-muted]" />
      <span class="font-semibold text-13px text-[--text-primary]">{{ title }}</span>
    </div>
    <p class="mb-8px">{{ body }}</p>
    <ol class="mb-8px pl-16px list-decimal space-y-2px">
      <li>{{ step1 }}</li>
      <li>{{ step2 }}</li>
    </ol>
    <p class="mb-12px opacity-80">{{ noteOnline }}<br />{{ noteIgnore }}</p>
    <button
      class="px-12px py-6px rounded-lg text-12px font-medium cursor-pointer border border-[--border-color] bg-[--bg-hover] text-[--text-primary] hover:opacity-85 transition-opacity"
      @click="$emit('dismiss')"
    >
      {{ dismissLabel }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SvgIcon from '@/components/SvgIcon.vue'
import { isZhLang } from '../core/onboarding'

defineEmits<{
  (e: 'dismiss'): void
}>()

const zh = isZhLang()
const title = computed(() => (zh ? '为什么侧边栏是空的？' : 'Why is the sidebar empty?'))
const body = computed(() =>
  zh
    ? '本地文件需要扩展权限才能列出目录。按下面两步开启后刷新即可：'
    : 'Listing local files needs an extension permission. Enable it in two steps, then refresh:'
)
const step1 = computed(() =>
  zh
    ? '打开 chrome://extensions，找到 MarkCraft'
    : 'Open chrome://extensions and find MarkCraft'
)
const step2 = computed(() =>
  zh
    ? '点「详情」→ 打开「允许访问文件网址」'
    : 'Open “Details” → turn on “Allow access to file URLs”'
)
const noteOnline = computed(() =>
  zh ? '在线文档不受影响，无需任何操作。' : 'Online documents are unaffected.'
)
const noteIgnore = computed(() =>
  zh
    ? '如果你确认已经开过开关，或当前目录确实没有 Markdown 文件，请忽略并关闭本提示。'
    : 'If you already enabled it, or this folder genuinely has no Markdown files, just dismiss this card.'
)
const dismissLabel = computed(() => (zh ? '知道了，不再提示' : 'Got it, don’t show again'))
</script>
