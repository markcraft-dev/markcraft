export interface TreeNodeItem {
  id: string | number
  content: string
  isFolder: boolean
  href: string
  size?: number
  sizeUnit?: string
  modifiedDate?: number
  date?: Date
  active?: boolean
  expanded?: boolean
  leafExpandable?: boolean
  isHiddenFile?: boolean
  hidden?: boolean
  children?: TreeNodeItem[]
  parentPath?: string
}

export interface OutlineItem {
  id: number
  parentId: number | null
  href: string
  content: string
  level: number
  active: boolean
  expanded: boolean
  hidden?: boolean
  children?: OutlineItem[]
}

export interface UserSettings {
  pageTheme: 'auto' | 'light' | 'dark'
  textFont: string
  textSize: string
  sideWidth?: number
  enableCustomContentWidth: boolean
  customContentWidth?: number
  enableCustomCSS: boolean
  customCSS?: string
  refresh: number
  maxOutlineExpandLevel: number
  mdPlugins: string[]
  mdPluginOptions: Record<string, any>
  charsetCompat?: boolean
}

export interface AppState {
  isLocal: boolean
  isDir: boolean
  currentSideType: 'folder' | 'outline'
  pageTheme: 'auto' | 'light' | 'dark'
  sideCollapsed: boolean
  sideExpanded: boolean
  sideHover: boolean
  headElements: HTMLElement[]
  sideFolder: {
    tree: TreeNodeItem[]
    fileURL: string
    baseFileURL: string
  }
  sideOutline: {
    tree: OutlineItem[]
    list: OutlineItem[]
  }
  loading: boolean
  reloading: boolean
  aboutVisible: boolean
  textSize: string
  language: string
  mode: string
}
