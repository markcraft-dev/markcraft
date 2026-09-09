<template>
  <span class="svg-icon" aria-hidden="true" v-html="svg"></span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  name: string
}>()

const iconSources = import.meta.glob('../assets/icon_assets/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default'
}) as Record<string, string>

const iconAliases: Record<string, string> = {
  'columns2': 'IconColumns.svg',
  'device-auto': 'IconDeviceAuto.svg',
  'file-text': 'IconFileMarkdown.svg',
  'list-tree': 'IconOutline.svg',
  'monitor-smartphone': 'IconDeviceAuto.svg',
  'panel-left': 'IconSidebarLeft.svg',
  'panel-right': 'IconSidebarRight.svg',
  'square-pen': 'IconEdit.svg',
  x: 'IconClose.svg',
}

const svg = computed(() => {
  const filename = iconAliases[props.name] ?? `Icon${props.name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')}.svg`
  return iconSources[`../assets/icon_assets/${filename}`] ?? ''
})
</script>

<style>
.svg-icon {
  display: inline-flex;
  width: 1em;
  height: 1em;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  line-height: 0;
  color: inherit;
}

.svg-icon > svg {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
