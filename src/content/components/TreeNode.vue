<template>
  <div class="tree-node select-none" :class="{ 'is-active': item.active, 'is-folder': item.isFolder }" v-show="!item.hidden">
    <div
      class="tree-node-row group flex items-center py-5px px-8px rounded-lg cursor-pointer text-13px transition-colors select-none"
      :class="item.active
        ? 'bg-[--bg-active] text-[--text-primary] font-semibold'
        : 'text-[--text-secondary] hover:bg-[--bg-hover] hover:text-[--text-primary]'"
      :style="{ paddingLeft: `${depth * 14 + 8}px` }"
      @click="handleClick"
    >
      <!-- Expand / Collapse chevron for folders -->
      <span
        v-if="item.isFolder"
        class="icon-chevron mr-4px flex items-center justify-center w-4 h-4 opacity-50 group-hover:opacity-100 transition-transform"
        :class="{ 'rotate-90': item.expanded }"
        @click.stop="handleToggle"
      >
        <IconChevronRight class="w-3.5 h-3.5" />
      </span>
      <span v-else class="w-4 mr-4px flex-shrink-0"></span>

      <!-- Folder vs File Icon -->
      <span class="node-icon mr-6px flex items-center justify-center w-4 h-4 flex-shrink-0" :class="iconColorClass">
        <IconFolderOpen v-if="item.isFolder && item.expanded" class="w-4 h-4" />
        <IconFolder v-else-if="item.isFolder" class="w-4 h-4" />
        <IconFileMarkdown v-else-if="isMarkdownFile" class="w-4 h-4" />
        <IconFile v-else class="w-4 h-4" />
      </span>

      <!-- File / Folder Name -->
      <span class="node-label truncate flex-1 leading-snug" :title="item.content">
        {{ item.content }}
      </span>

      <!-- Active Indicator Dot or New Tab Action -->
      <span
        v-if="item.active"
        class="w-1.5 h-1.5 rounded-full bg-[--primary-color] flex-shrink-0 ml-4px"
      ></span>
      <span
        v-else-if="!item.isFolder"
        class="node-action opacity-0 group-hover:opacity-100 p-2px rounded hover:bg-[--bg-subtle] text-[--text-muted] hover:text-[--text-primary] transition-opacity flex-shrink-0 ml-4px"
        title="在新标签页中打开"
        @click.stop="handleOpenExternal"
      >
        <IconExternalLink class="w-3.5 h-3.5" />
      </span>
    </div>

    <!-- Recursive children -->
    <div v-if="item.isFolder && item.expanded && item.children" class="tree-node-children">
      <TreeNode
        v-for="child in item.children"
        :key="child.id || child.href"
        :item="child"
        :depth="depth + 1"
        @toggle="(n) => $emit('toggle', n)"
        @select="(n) => $emit('select', n)"
        @open-new-tab="(n) => $emit('open-new-tab', n)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import IconChevronRight from '@/components/icons/IconChevronRight.vue'
import IconFolder from '@/components/icons/IconFolder.vue'
import IconFolderOpen from '@/components/icons/IconFolderOpen.vue'
import IconFileMarkdown from '@/components/icons/IconFileMarkdown.vue'
import IconFile from '@/components/icons/IconFile.vue'
import IconExternalLink from '@/components/icons/IconExternalLink.vue'
import type { TreeNodeItem } from '@/shared/types'

const props = withDefaults(
  defineProps<{
    item: TreeNodeItem
    depth?: number
  }>(),
  {
    depth: 0
  }
)

const emit = defineEmits<{
  (e: 'toggle', item: TreeNodeItem): void
  (e: 'select', item: TreeNodeItem): void
  (e: 'open-new-tab', item: TreeNodeItem): void
}>()

const isMarkdownFile = computed(() => {
  const name = props.item.content.toLowerCase()
  return name.endsWith('.md') || name.endsWith('.markdown') || name.endsWith('.mkd') || name.endsWith('.txt')
})

const iconColorClass = computed(() => {
  if (props.item.isFolder) return 'text-amber-500/90 dark:text-amber-400/90'
  if (isMarkdownFile.value) return 'text-blue-500/90 dark:text-blue-400/90'
  return 'text-slate-400'
})

function handleToggle() {
  props.item.expanded = !props.item.expanded
  emit('toggle', props.item)
}

function handleClick() {
  if (props.item.isFolder) {
    handleToggle()
  } else {
    emit('select', props.item)
  }
}

function handleOpenExternal() {
  emit('open-new-tab', props.item)
}
</script>

<style scoped>
.tree-node-row {
  margin: 1px 0;
}
</style>
