/**
 * MarkCraft Local File Handle Storage & Silent Disk Writer
 * Uses IndexedDB to persist FileSystemFileHandle and FileSystemDirectoryHandle
 * enabling 100% silent in-place file modifications without repetitive OS dialogs.
 */

const DB_NAME = 'markcraft_filesystem_db'
const DB_VERSION = 1
const STORE_HANDLES = 'handles'

// In-memory session cache for instant access
const sessionHandleCache = new Map<string, FileSystemFileHandle>()
let sessionDirectoryHandle: FileSystemDirectoryHandle | null = null

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_HANDLES)) {
        db.createObjectStore(STORE_HANDLES)
      }
    }
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
 */
export async function trySilentSave(fileUrl: string, content: string): Promise<boolean> {
  const fileName = decodeURIComponent(fileUrl.split('/').pop() || '')

  // 1. Try exact file URL key
  let handle = await retrieveFileHandle(fileUrl)
  if (!handle && fileName) {
    handle = await retrieveFileHandle(fileName)
  }

  if (handle) {
    const ok = await writeToFileHandle(handle, content)
    if (ok) return true
  }

  return false
}
