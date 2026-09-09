import type { OutlineItem } from '@/shared/types'

const INVALID_CHARS = /[^\p{L}\p{M}\p{Nd}\p{Nl}\p{Pc}\- ]/gu

export function generateSlug(text: string, counters: Record<string, number>): string {
  const base = encodeURIComponent(
    text.toLowerCase().replace(/ /g, '-').replace(INVALID_CHARS, '').trim()
  )
  if (base in counters) {
    return `${base}-${counters[base]++}`
  }
  counters[base] = 1
  return base
}

export function extractOutline(container: HTMLElement, maxLevel = 6): { tree: OutlineItem[]; list: OutlineItem[] } {
  const headings = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6')) as HTMLElement[]
  const flatResult: OutlineItem[] = []
  const treeResult: OutlineItem[] = []
  const stack: OutlineItem[] = []
  const counters: Record<string, number> = {}

  headings.forEach((heading, idx) => {
    const text = (heading.textContent || '').trim()
    const slug = generateSlug(text, counters)
    heading.setAttribute('id', slug)

    const level = Number.parseInt(heading.tagName.slice(1), 10)
    const item: OutlineItem = {
      id: idx,
      parentId: null,
      href: `#${slug}`,
      content: text,
      level,
      active: false,
      expanded: level <= maxLevel
    }

    flatResult.push(item)

    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop()
    }

    if (stack.length === 0) {
      treeResult.push(item)
    } else {
      const parent = stack[stack.length - 1]
      parent.children = parent.children || []
      item.parentId = parent.id
      parent.children.push(item)
    }

    stack.push(item)
  })

  return { tree: treeResult, list: flatResult }
}
