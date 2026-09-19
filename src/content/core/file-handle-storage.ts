/**
 * MarkCraft Local File Handle Storage & Silent Disk Writer
 * Uses IndexedDB to persist FileSystemFileHandle and FileSystemDirectoryHandle
 * enabling 100% silent in-place file modifications without repetitive OS dialogs.
 *
 * 授权策略：目录句柄按「目录 URL」持久化；保存时取 URL 前缀匹配最长的
 * 已授权目录，沿剩余路径逐级下钻定位原文件直接覆盖（create:false，绝不新建）。
 */

const DB_NAME = 'markcraft_filesystem_db'
const DB_VERSION = 1
const STORE_HANDLES = 'handles'

// In-memory session cache for instant access
const sessionHandleCache = new Map<string, FileSystemFileHandle>()
let sessionDirectoryHandle: FileSystemDirectoryHandle | null = null
let sessionDirectoryKey = ''

interface StoredDirectory {
  url: string
  handle: FileSystemDirectoryHandle
}

// 连接懒加载单例：避免每次操作各开一条连接堆积依赖 GC；
// 版本变更（onversionchange）时主动关闭并在下次调用时重开
let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_HANDLES)) {
        db.createObjectStore(STORE_HANDLES)
      }
    }
    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => {
        db.close()
        dbPromise = null
      }
      resolve(db)
    }
    request.onerror = () => {
      dbPromise = null
      reject(request.error)
    }
  })
  return dbPromise
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function storeFileHandle(key: string, handle: FileSystemFileHandle): Promise<void> {
  sessionHandleCache.set(key, handle)
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_HANDLES, 'readwrite')
    tx.objectStore(STORE_HANDLES).put(handle, key)
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve
      tx.onerror = reject
    })
  } catch (err) {
    console.warn('Failed to store handle in IndexedDB:', err)
  }
}

export async function retrieveFileHandle(key: string): Promise<FileSystemFileHandle | null> {
  if (sessionHandleCache.has(key)) {
    return sessionHandleCache.get(key)!
  }
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_HANDLES, 'readonly')
    const request = tx.objectStore(STORE_HANDLES).get(key)
    const handle = await new Promise<FileSystemFileHandle | null>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
    if (handle) {
      sessionHandleCache.set(key, handle)
    }
    return handle
  } catch (err) {
    console.warn('Failed to retrieve handle from IndexedDB:', err)
    return null
  }
}

export async function storeDirectoryHandle(key: string, handle: FileSystemDirectoryHandle): Promise<void> {
  sessionDirectoryKey = key
  sessionDirectoryHandle = handle
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_HANDLES, 'readwrite')
    tx.objectStore(STORE_HANDLES).put(handle, `dir:${key}`)
    await new Promise((resolve, reject) => {
      tx.oncomplete = resolve
      tx.onerror = reject
    })
  } catch (err) {
    console.warn('Failed to store dir handle:', err)
  }
}

export async function retrieveDirectoryHandle(key: string): Promise<FileSystemDirectoryHandle | null> {
  if (sessionDirectoryKey === key && sessionDirectoryHandle) {
    return sessionDirectoryHandle
  }
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_HANDLES, 'readonly')
    const request = tx.objectStore(STORE_HANDLES).get(`dir:${key}`)
    const handle = await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
    if (handle) {
      sessionDirectoryKey = key
      sessionDirectoryHandle = handle
    }
    return handle
  } catch (err) {
    console.warn('Failed to retrieve dir handle:', err)
    return null
  }
}

/** 读取全部已授权目录（IndexedDB 优先，不可用时退回会话缓存）。 */
async function listStoredDirectories(): Promise<StoredDirectory[]> {
  const entries: StoredDirectory[] = []
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_HANDLES, 'readonly')
    const store = tx.objectStore(STORE_HANDLES)
    const [keys, values] = await Promise.all([
      requestToPromise(store.getAllKeys()),
      requestToPromise(store.getAll())
    ])
    keys.forEach((key, idx) => {
      const url = String(key).slice('dir:'.length)
      const handle = values[idx] as FileSystemDirectoryHandle | undefined
      if (String(key).startsWith('dir:') && url && handle) {
        entries.push({ url, handle })
      }
    })
  } catch (err) {
    console.warn('Failed to list directory handles:', err)
  }
  if (entries.length === 0 && sessionDirectoryKey && sessionDirectoryHandle) {
    entries.push({ url: sessionDirectoryKey, handle: sessionDirectoryHandle })
  }
  return entries
}

/** 永不抛出的 decodeURIComponent：畸形 % 序列时回退原文，避免调用方静默跳过保存。 */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/** 从文件 URL 中拆出目录 URL（含尾斜杠）与解码后的文件名。 */
function splitFileUrl(fileUrl: string): { dirUrl: string; fileName: string } | null {
  const clean = fileUrl.split('#')[0].split('?')[0]
  const slash = clean.lastIndexOf('/')
  if (slash === -1) return null
  const fileName = safeDecode(clean.slice(slash + 1))
  if (!fileName) return null
  return { dirUrl: clean.slice(0, slash + 1), fileName }
}

/**
 * Execute silent write to a FileSystemFileHandle with automatic permission request
 */
export async function writeToFileHandle(handle: FileSystemFileHandle, content: string): Promise<boolean> {
  try {
    // Check permission state
    let permission = await (handle as any).queryPermission?.({ mode: 'readwrite' })
    if (permission !== 'granted') {
      permission = await (handle as any).requestPermission?.({ mode: 'readwrite' })
    }
    if (permission !== 'granted') {
      return false
    }

    const writable = await (handle as any).createWritable({ keepExistingData: false })
    await writable.write(content)
    await writable.close()
    return true
  } catch (err) {
    console.warn('Error writing to file handle:', err)
    return false
  }
}

/**
 * Perform silent save to the given file URL if a handle is already authorized
 *
 * 安全约束：只允许以「完整 file:// URL」为键命中句柄。禁止按裸文件名兜底检索——
 * file:// 页面共享同一透明 origin，不同目录的同名文件会命中彼此的句柄，
 * 造成静默把 A 文件内容写成 B 的数据损坏。
 */
export async function trySilentSave(fileUrl: string, content: string): Promise<boolean> {
  const handle = await retrieveFileHandle(fileUrl)

  if (handle) {
    const ok = await writeToFileHandle(handle, content)
    if (ok) return true
  }

  return false
}

/**
 * 通过已授权目录句柄静默覆盖原文件：目录 URL 前缀匹配最长的条目优先，
 * 剩余路径段逐级下钻；create:false 保证只覆盖既有文件、绝不新建。
 */
export async function trySilentSaveViaDirectory(fileUrl: string, content: string): Promise<boolean> {
  const parsed = splitFileUrl(fileUrl)
  if (!parsed) return false
  const { dirUrl, fileName } = parsed

  const candidates = (await listStoredDirectories())
    .filter((entry) => dirUrl.startsWith(entry.url))
    .sort((a, b) => b.url.length - a.url.length)

  for (const entry of candidates) {
    try {
      let current: FileSystemDirectoryHandle = entry.handle
      const rest = dirUrl.slice(entry.url.length)
      for (const segment of rest.split('/').filter(Boolean)) {
        current = await current.getDirectoryHandle(safeDecode(segment), { create: false })
      }
      const fileHandle = await current.getFileHandle(fileName, { create: false })
      if (await writeToFileHandle(fileHandle, content)) {
        return true
      }
    } catch {
      // 目录不匹配 / 文件不存在 / 权限不足：尝试下一个候选
    }
  }
  return false
}
