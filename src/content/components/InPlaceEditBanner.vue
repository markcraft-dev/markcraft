<template>
  <div class="in-place-banner fixed top-52px left-1/2 -translate-x-1/2 z-40 flex items-center gap-8px px-12px py-5px rounded-full bg-[--bg-card]/95 backdrop-blur-xl border border-[--border-color] shadow-xl text-12px select-none animate-in">
    <!-- Status & Indicator -->
    <div class="flex items-center gap-6px pr-8px border-r border-[--border-color]">
      <span class="w-2 h-2 rounded-full" :class="isDirty ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'"></span>
      <span class="font-semibold text-[--text-primary]">所见即所得编辑</span>
      <span class="text-11px text-[--text-muted]">({{ isDirty ? '未保存' : '已保存' }})</span>
    </div>

    <!-- Quick Actions -->
    <div class="flex items-center gap-4px">
      <!-- Save to Disk -->
      <button
        class="action-btn px-9px py-3.5px rounded-full font-medium transition-colors"
        :class="isDirty ? 'bg-[--primary-color] text-white hover:bg-[--primary-hover] shadow-xs' : 'bg-[--bg-subtle] text-[--text-secondary] hover:text-[--text-primary]'"
        title="保存至本地文件 (Cmd+S)"
        @click="$emit('save')"
      >
        <span>💾 保存 (⌘S)</span>
      </button>

      <!-- Done / Exit Edit -->
      <button
        class="action-btn px-9px py-3.5px rounded-full bg-[--bg-subtle] text-[--text-primary] hover:bg-[--bg-hover] font-medium"
        title="完成并退出编辑模式 (Cmd+E)"
        @click="$emit('finish')"
      >
        <span>✓ 完成 (⌘E)</span>
      </button>

      <!-- Discard Changes -->
      <button
        class="action-btn px-7px py-3.5px rounded-full text-[--text-muted] hover:text-red-500 hover:bg-red-500/10 font-normal"
        title="放弃当前未保存的修改并重新载入"
        @click="$emit('cancel')"
      >
        <span>放弃修改</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  isDirty: boolean
}>()

defineEmits<{
  (e: 'save'): void
  (e: 'finish'): void
  (e: 'cancel'): void
}>()
</script>

<style scoped>
.action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  border: 0;
  outline: none;
  cursor: pointer;
  font-size: 11px;
}
</style>
