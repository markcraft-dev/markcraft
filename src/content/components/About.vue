<template>
  <div v-if="visible" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-16px" @click.self="$emit('close')">
    <div class="bg-[--bg-card] text-[--text-primary] rounded-xl p-24px max-w-400px w-full shadow-2xl border border-[--border-color]">
      <div class="flex items-center gap-12px mb-16px">
        <IconLogo class="w-36px h-36px" />
        <div>
          <h3 class="font-bold text-16px">MarkCraft</h3>
          <p class="text-12px text-[--muted-color]">v1.0.1 (Official Release)</p>
        </div>
      </div>
      <p class="text-13px text-[--text-secondary] mb-16px leading-relaxed">
        极美排版与所见即所得 Markdown 浏览器阅读与写作工作台。支持本地文件树智能导航、暗黑模式、数学公式与图表即时渲染。
      </p>
      <div class="flex justify-end">
        <button class="px-14px py-6px rounded bg-[--primary-color] text-white text-13px cursor-pointer border-0 outline-none" @click="$emit('close')">
          关闭
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import IconLogo from '@/components/icons/IconLogo.vue'

defineProps<{ visible: boolean }>()
defineEmits<{ (e: 'close'): void }>()
</script>
