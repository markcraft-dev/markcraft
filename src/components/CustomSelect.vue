<template>
  <div
    ref="containerRef"
    class="custom-select-container relative select-none"
    :class="[
      isOpen ? 'z-40' : 'z-1',
      { 'opacity-50 pointer-events-none': disabled }
    ]"
  >
    <!-- Trigger Button -->
    <button
      type="button"
      class="custom-select-trigger w-full flex items-center justify-between gap-8px py-6.5px px-9px rounded-lg border transition-all text-12px outline-none cursor-pointer"
      :class="[
        isOpen
          ? 'border-[--primary-color] ring-2 ring-blue-500/20 bg-[--bg-page]'
          : 'border-[--border-color] bg-[--bg-subtle] hover:border-[--text-muted] hover:bg-[--bg-hover]'
      ]"
      :disabled="disabled"
      aria-haspopup="listbox"
      :aria-expanded="isOpen"
      @click="toggleDropdown"
      @keydown="handleKeydown"
    >
      <span class="flex items-center gap-6px min-w-0 truncate text-left">
        <span class="font-medium text-[--text-primary] truncate">{{ selectedOption?.label || placeholder }}</span>
        <span v-if="selectedOption?.subLabel" class="text-11px text-[--text-muted] truncate font-normal opacity-80">
          ({{ selectedOption.subLabel }})
        </span>
      </span>

      <!-- Chevron Arrow -->
      <span
        class="flex-shrink-0 text-[--text-muted] transition-transform duration-200"
        :class="{ 'rotate-180 text-[--primary-color]': isOpen }"
      >
        <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path
            fill-rule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clip-rule="evenodd"
          />
        </svg>
      </span>
    </button>

    <!-- Dropdown Menu -->
    <transition name="select-dropdown">
      <div
        v-if="isOpen"
        ref="menuRef"
        class="custom-select-menu absolute left-0 right-0 top-[calc(100%+4px)] z-50 min-w-full rounded-xl p-4px shadow-xl border border-[--border-color] bg-[--bg-card]/98 backdrop-blur-xl max-h-220px overflow-y-auto"
        role="listbox"
        tabindex="-1"
      >
        <div
          v-for="(option, index) in options"
          :key="option.value"
          :ref="el => { if (index === highlightedIndex) highlightedEl = el as HTMLElement }"
          class="custom-select-option flex items-center justify-between gap-8px px-9px py-6px rounded-lg cursor-pointer transition-colors text-12px select-none"
          :class="[
            option.value === modelValue
              ? 'bg-[--primary-light] text-[--primary-color] font-semibold'
              : index === highlightedIndex
              ? 'bg-[--bg-hover] text-[--text-primary]'
              : 'text-[--text-secondary] hover:bg-[--bg-hover] hover:text-[--text-primary]'
          ]"
          role="option"
          :aria-selected="option.value === modelValue"
          @click="selectOption(option)"
          @mouseenter="highlightedIndex = index"
        >
          <div class="flex items-center gap-6px min-w-0 truncate">
            <span class="truncate">{{ option.label }}</span>
            <span
              v-if="option.subLabel"
              class="text-10.5px px-5px py-0.5 rounded font-mono truncate border"
              :class="[
                option.value === modelValue
                  ? 'bg-[--bg-page] text-[--primary-color] border-[--border-color] font-medium'
                  : 'bg-[--bg-page] text-[--text-muted] border-[--border-subtle]'
              ]"
            >
              {{ option.subLabel }}
            </span>
          </div>

          <!-- Active Checkmark -->
          <span v-if="option.value === modelValue" class="flex-shrink-0 text-[--primary-color] flex items-center">
            <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fill-rule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clip-rule="evenodd"
              />
            </svg>
          </span>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'

export interface SelectOption {
  value: string | number
  label: string
  subLabel?: string
}

const props = withDefaults(
  defineProps<{
    modelValue: string | number
    options: SelectOption[]
    placeholder?: string
    disabled?: boolean
  }>(),
  {
    placeholder: '请选择',
    disabled: false
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', val: any): void
  (e: 'change', val: any): void
}>()

const isOpen = ref(false)
const containerRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const highlightedIndex = ref(-1)
const highlightedEl = ref<HTMLElement | null>(null)

const selectedOption = computed(() => {
  return props.options.find(opt => opt.value === props.modelValue)
})

function toggleDropdown() {
  if (props.disabled) return
  if (isOpen.value) {
    closeDropdown()
  } else {
    openDropdown()
  }
}

function openDropdown() {
  isOpen.value = true
  const curIdx = props.options.findIndex(opt => opt.value === props.modelValue)
  highlightedIndex.value = curIdx >= 0 ? curIdx : 0
  nextTick(() => {
    scrollToHighlighted()
  })
}

function closeDropdown() {
  isOpen.value = false
  highlightedIndex.value = -1
}

function selectOption(option: SelectOption) {
  emit('update:modelValue', option.value)
  emit('change', option.value)
  closeDropdown()
}

function scrollToHighlighted() {
  if (highlightedEl.value && menuRef.value) {
    highlightedEl.value.scrollIntoView({ block: 'nearest' })
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (props.disabled) return

  if (!isOpen.value) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openDropdown()
    }
    return
  }

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      if (highlightedIndex.value < props.options.length - 1) {
        highlightedIndex.value++
        nextTick(() => scrollToHighlighted())
      }
      break
    case 'ArrowUp':
      e.preventDefault()
      if (highlightedIndex.value > 0) {
        highlightedIndex.value--
        nextTick(() => scrollToHighlighted())
      }
      break
    case 'Enter':
    case ' ':
      e.preventDefault()
      if (highlightedIndex.value >= 0 && highlightedIndex.value < props.options.length) {
        selectOption(props.options[highlightedIndex.value])
      }
      break
    case 'Escape':
      e.preventDefault()
      e.stopPropagation()
      closeDropdown()
      break
    case 'Tab':
      closeDropdown()
      break
  }
}

function handlePointerDownOutside(e: PointerEvent) {
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    closeDropdown()
  }
}

onMounted(() => {
  window.addEventListener('pointerdown', handlePointerDownOutside, true)
})

onUnmounted(() => {
  window.removeEventListener('pointerdown', handlePointerDownOutside, true)
})
</script>

<style scoped>
.select-dropdown-enter-active,
.select-dropdown-leave-active {
  transition: opacity 0.15s cubic-bezier(0.16, 1, 0.3, 1), transform 0.15s cubic-bezier(0.16, 1, 0.3, 1);
}

.select-dropdown-enter-from,
.select-dropdown-leave-to {
  opacity: 0;
  transform: scale(0.97);
}

/* Custom scrollbar */
.custom-select-menu::-webkit-scrollbar {
  width: 4px;
}
.custom-select-menu::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 4px;
}
.custom-select-menu::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}
</style>
