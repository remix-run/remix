import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

export type DemoFile = {
  absolutePath: string
  assetHref: string
  description?: string
  href: string
  importHref: string
  layout?: DemoLayout
  order?: number
  relativePath: string
  ssr: boolean
  title: string
}

export type DemoLayout = 'center'

const UI_DIRECTORY = path.resolve(url.fileURLToPath(new URL('../../..', import.meta.url)))
const DEMO_FILE_REGEX = /\.demo\.(tsx|ts)$/

export function discoverDemoFiles(): DemoFile[] {
  return walkDemoFiles(UI_DIRECTORY).map(createDemoFile).sort(compareDemoFiles)
}

export function findDemoFile(filename: string) {
  let normalizedFilename = normalizeFilename(filename)
  if (!normalizedFilename) return undefined

  return discoverDemoFiles().find((demo) => demo.relativePath === normalizedFilename)
}

export function getDemoDirectory() {
  return UI_DIRECTORY
}

export async function loadDemoModule(
  demo: Pick<DemoFile, 'absolutePath' | 'importHref' | 'title'>,
) {
  let version = fs.statSync(demo.absolutePath).mtimeMs.toString(36)
  let mod = await import(`${demo.importHref}?v=${version}`)

  if (typeof mod.default !== 'function') {
    throw new Error(`Demo "${demo.title}" must default export a component function`)
  }

  return mod.default
}

function createDemoFile(absolutePath: string): DemoFile {
  let relativePath = path.relative(UI_DIRECTORY, absolutePath).split(path.sep).join('/')
  let source = fs.readFileSync(absolutePath, 'utf8')
  let metadata = readDemoMetadata(source)

  return {
    absolutePath,
    assetHref: `/assets/demos/${toAssetPath(relativePath)}`,
    description: metadata.description,
    href: `/demo/${relativePath}`,
    importHref: url.pathToFileURL(absolutePath).href,
    layout: metadata.layout,
    order: metadata.order,
    relativePath,
    ssr: metadata.ssr ?? true,
    title: metadata.name ?? humanizeDemoPath(relativePath),
  }
}

function compareDemoFiles(a: DemoFile, b: DemoFile) {
  let directoryCompare = path.dirname(a.relativePath).localeCompare(path.dirname(b.relativePath))
  if (directoryCompare !== 0) return directoryCompare

  let aOrder = a.order ?? Number.MAX_SAFE_INTEGER
  let bOrder = b.order ?? Number.MAX_SAFE_INTEGER
  if (aOrder !== bOrder) return aOrder - bOrder

  return a.title.localeCompare(b.title)
}

function humanizeDemoPath(relativePath: string) {
  return path
    .basename(relativePath)
    .replace(DEMO_FILE_REGEX, '')
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(' ')
}

function normalizeFilename(filename: string) {
  let decoded = decodeURIComponent(filename)
  let normalized = path.posix.normalize(decoded)

  if (
    path.posix.isAbsolute(normalized) ||
    normalized === '.' ||
    normalized.startsWith('../') ||
    normalized.includes('/../') ||
    !DEMO_FILE_REGEX.test(normalized)
  ) {
    return undefined
  }

  return normalized
}

function readDemoMetadata(source: string) {
  let comment = source.match(/\/\*\*([\s\S]*?)\*\//)?.[1] ?? ''
  let metadata: {
    description?: string
    layout?: DemoLayout
    name?: string
    order?: number
    ssr?: boolean
  } = {}

  for (let key of ['description', 'layout', 'name', 'order'] as const) {
    let value = comment.match(new RegExp(`@${key}\\s+([^\\n]+)`))?.[1]?.trim()
    if (!value) continue

    if (key === 'order') {
      let order = Number(value)
      if (Number.isFinite(order)) metadata.order = order
      continue
    }

    if (key === 'layout') {
      if (isDemoLayout(value)) metadata.layout = value
      continue
    }

    metadata[key] = value
  }

  let ssrValue = comment.match(/@ssr\s+([^\n]+)/)?.[1]?.trim().toLowerCase()
  if (ssrValue === 'false') metadata.ssr = false

  return metadata
}

function isDemoLayout(value: string): value is DemoLayout {
  return value === 'center'
}

function shouldIgnoreEntry(name: string) {
  return (
    name === 'node_modules' ||
    name === 'build' ||
    name === 'public' ||
    name.startsWith('.') ||
    name.endsWith('.bundled.js')
  )
}

function toAssetPath(relativePath: string) {
  return relativePath.replace(DEMO_FILE_REGEX, '.js')
}

function walkDemoFiles(directory: string): string[] {
  let files: string[] = []

  for (let entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (shouldIgnoreEntry(entry.name)) continue

    let absolutePath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...walkDemoFiles(absolutePath))
      continue
    }

    if (!entry.isFile() || !DEMO_FILE_REGEX.test(entry.name)) continue
    files.push(absolutePath)
  }

  return files
}
