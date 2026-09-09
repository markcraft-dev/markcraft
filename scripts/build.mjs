import { build } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const outDir = resolve(rootDir, 'dist')
const isWatch = process.argv.includes('--watch') || process.argv.includes('-w')

function toAscii(str) {
  return str.replace(/[\u007F-\uFFFF]/g, function(c) {
    return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4)
  })
}

async function copyDir(src, dest) {
  await fs.promises.mkdir(dest, { recursive: true })
  const entries = await fs.promises.readdir(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcPath = resolve(src, entry.name)
    const destPath = resolve(dest, entry.name)
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath)
    } else {
      await fs.promises.copyFile(srcPath, destPath)
    }
  }
}

let isBuilding = false
let pendingBuild = false

async function runBuild() {
  if (isBuilding) {
    pendingBuild = true
    return
  }
  isBuilding = true
  const startTime = Date.now()

  try {
    console.log(`\n📦 [${new Date().toLocaleTimeString()}] Building extension...`)

    // Clean dist
    if (fs.existsSync(outDir)) {
      fs.rmSync(outDir, { recursive: true, force: true })
    }
    fs.mkdirSync(outDir, { recursive: true })

    // 1. Build Popup, Options & Resources HTML
    await build({
      root: rootDir,
      logLevel: 'warn',
      plugins: [vue(), UnoCSS(), wasm(), topLevelAwait()],
      resolve: {
        alias: { '@': resolve(rootDir, 'src') }
      },
      build: {
        outDir,
        emptyOutDir: false,
        rollupOptions: {
          input: {
            popup: resolve(rootDir, 'src/popup/index.html'),
            options: resolve(rootDir, 'src/options/index.html')
          }
        }
      }
    })

    // Move dist/src/popup/index.html to dist/popup/index.html
    if (fs.existsSync(resolve(outDir, 'src/popup/index.html'))) {
      await fs.promises.mkdir(resolve(outDir, 'popup'), { recursive: true })
      await fs.promises.rename(
        resolve(outDir, 'src/popup/index.html'),
        resolve(outDir, 'popup/index.html')
      )
    }

    // Move dist/src/options/index.html to dist/options/index.html
    if (fs.existsSync(resolve(outDir, 'src/options/index.html'))) {
      await fs.promises.mkdir(resolve(outDir, 'options'), { recursive: true })
      await fs.promises.rename(
        resolve(outDir, 'src/options/index.html'),
        resolve(outDir, 'options/index.html')
      )
    }

    // Remove leftover dist/src folder
    if (fs.existsSync(resolve(outDir, 'src'))) {
      fs.rmSync(resolve(outDir, 'src'), { recursive: true, force: true })
    }

    // 2. Build Content Script (IIFE global bundle)
    await build({
      root: rootDir,
      logLevel: 'warn',
      publicDir: false,
      plugins: [vue(), UnoCSS(), wasm(), topLevelAwait()],
      resolve: {
        alias: { '@': resolve(rootDir, 'src') }
      },
      define: {
        'process.env.NODE_ENV': JSON.stringify(isWatch ? 'development' : 'production')
      },
      build: {
        outDir: resolve(outDir, 'content'),
        emptyOutDir: false,
        lib: {
          entry: resolve(rootDir, 'src/content/index.ts'),
          name: 'MdrContent',
          formats: ['iife'],
          fileName: () => 'index.global.js'
        },
        rollupOptions: {
          output: {
            extend: true
          }
        }
      }
    })

    // 3. Build Background Service Worker (ESM)
    await build({
      root: rootDir,
      logLevel: 'warn',
      publicDir: false,
      resolve: {
        alias: { '@': resolve(rootDir, 'src') }
      },
      build: {
        outDir: resolve(outDir, 'background'),
        emptyOutDir: false,
        lib: {
          entry: resolve(rootDir, 'src/background/index.ts'),
          formats: ['es'],
          fileName: () => 'index.mjs'
        }
      }
    })

    // 4. Copy static assets, locales, manifest.json
    await fs.promises.copyFile(
      resolve(rootDir, 'public/manifest.json'),
      resolve(outDir, 'manifest.json')
    )
    await copyDir(resolve(rootDir, 'public/assets'), resolve(outDir, 'assets'))
    await copyDir(resolve(rootDir, 'public/_locales'), resolve(outDir, '_locales'))
    if (fs.existsSync(resolve(rootDir, 'src/content/wasm'))) {
      await copyDir(resolve(rootDir, 'src/content/wasm'), resolve(outDir, 'content/wasm'))
    }

    // 5. Post-process UTF-8 encoding (convert non-ASCII code points in content script to standard \uXXXX escapes)
    const contentScriptPath = resolve(outDir, 'content/index.global.js')
    if (fs.existsSync(contentScriptPath)) {
      const raw = await fs.promises.readFile(contentScriptPath, 'utf8')
      const safeAscii = toAscii(raw)
      await fs.promises.writeFile(contentScriptPath, safeAscii, 'utf8')
    }

    // 6. Ensure correct permissions
    const chmodRecursive = async (dir) => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const full = resolve(dir, entry.name)
        await fs.promises.chmod(full, entry.isDirectory() ? 0o755 : 0o644)
        if (entry.isDirectory()) await chmodRecursive(full)
      }
    }
    await chmodRecursive(outDir)

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`✨ Build completed in ${elapsed}s! Output ready in dist/`)
  } catch (err) {
    console.error('❌ Build failed:', err)
  } finally {
    isBuilding = false
    if (pendingBuild) {
      pendingBuild = false
      runBuild()
    }
  }
}

async function startWatch() {
  await runBuild()
  console.log('\n👀 Watching src/ and public/ for changes... (Press Ctrl+C to stop)')

  let debounceTimer = null
  const triggerRebuild = (eventType, filename) => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      console.log(`🔄 Detected ${eventType} in ${filename}, rebuilding...`)
      runBuild()
    }, 200)
  }

  fs.watch(resolve(rootDir, 'src'), { recursive: true }, triggerRebuild)
  fs.watch(resolve(rootDir, 'public'), { recursive: true }, triggerRebuild)
}

if (isWatch) {
  startWatch()
} else {
  runBuild()
}
