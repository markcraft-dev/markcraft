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

const iconRegistry: Record<string, string> = {
  'arrow-left': 'IconArrowLeft.svg',
  'arrow-right': 'IconArrowRight.svg',
  'arrow-up': 'IconArrowUp.svg',
  bold: 'IconBold.svg',
  check: 'IconCheck.svg',
  'chevron-right': 'IconChevronRight.svg',
  clock: 'IconClock.svg',
  close: 'IconClose.svg',
  columns: 'IconColumns.svg',
  copy: 'IconCopy.svg',
  'corner-left-up': 'IconCornerLeftUp.svg',
  'device-auto': 'IconDeviceAuto.svg',
  download: 'IconDownload.svg',
  edit: 'IconEdit.svg',
  'external-link': 'IconExternalLink.svg',
  eye: 'IconEye.svg',
  file: 'IconFile.svg',
  'file-code': 'IconFileCode.svg',
  'file-markdown': 'IconFileMarkdown.svg',
  folder: 'IconFolder.svg',
  'folder-open': 'IconFolderOpen.svg',
  hash: 'IconHash.svg',
  heading: 'IconHeading.svg',
  image: 'IconImage.svg',
  info: 'IconInfo.svg',
  italic: 'IconItalic.svg',
  link: 'IconLink.svg',
  list: 'IconList.svg',
  maximize: 'IconMaximize.svg',
  minimize: 'IconMinimize.svg',
  moon: 'IconMoon.svg',
  outline: 'IconOutline.svg',
  printer: 'IconPrinter.svg',
  quote: 'IconQuote.svg',
  'rotate-ccw': 'IconRotateCcw.svg',
  save: 'IconSave.svg',
  search: 'IconSearch.svg',
  settings: 'IconSettings.svg',
  sidebar: 'IconSidebar.svg',
  'sidebar-left': 'IconSidebarLeft.svg',
  'sidebar-right': 'IconSidebarRight.svg',
  'sliders-horizontal': 'IconSlidersHorizontal.svg',
  sun: 'IconSun.svg',
  table: 'IconTable.svg',
}

const svg = computed(() => {
  const filename = iconRegistry[props.name]
  return filename ? iconSources[`../assets/icon_assets/${filename}`] ?? '' : ''
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
