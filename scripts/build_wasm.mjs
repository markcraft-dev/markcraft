import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const outDir = resolve(root, 'src/content/wasm')
mkdirSync(outDir, { recursive: true })
const result = spawnSync('wasm-pack', [
  'build', resolve(root, 'wasm/markdown_analyzer'), '--target', 'web',
  '--release', '--out-dir', outDir, '--out-name', 'markdown_analyzer'
], { cwd: root, stdio: 'inherit' })
if (result.status !== 0 || !existsSync(resolve(outDir, 'markdown_analyzer.js'))) process.exit(result.status || 1)
