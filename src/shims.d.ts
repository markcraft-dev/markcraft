// Type shims for untyped third-party modules so `tsc --noEmit` (CI) stays green.
// Runtime behavior is unchanged: Vite/rollup resolves these at bundle time.

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

declare module 'markdown-it-task-lists'
declare module 'markdown-it-emoji'
declare module 'markdown-it-sub'
declare module 'markdown-it-sup'
declare module 'markdown-it-ins'
declare module 'markdown-it-mark'
declare module 'markdown-it-deflist'
declare module 'markdown-it-abbr'
declare module 'markdown-it-footnote'
declare module '@mdit/plugin-alert'

// Vite `?raw` imports resolve to the file content as a string at bundle time
// (used for inlining katex.min.css into the standalone export template).
declare module '*?raw' {
  const content: string
  export default content
}
