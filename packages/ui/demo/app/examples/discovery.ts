import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

export type DiscoveredExampleFile = {
  absolutePath: string
  assetHref: string
  contentPath: string
  id: string
  importHref: string
  path: string
  relativePath: string
  slug: string
}

const EXAMPLES_DIRECTORY = url.fileURLToPath(new URL('.', import.meta.url))

export function discoverExampleFiles(): DiscoveredExampleFile[] {
  let files = walkExampleFiles(EXAMPLES_DIRECTORY).sort()
  let examples = files.map(createDiscoveredExampleFile)

  let slugPaths = new Map<string, string>()
  let idSlugs = new Map<string, string>()

  for (let example of examples) {
    let existingSlugPath = slugPaths.get(example.slug)
    if (existingSlugPath) {
      throw new Error(
        `Duplicate example slug "${example.slug}" for "${existingSlugPath}" and "${example.relativePath}"`,
      )
    }

    let existingIdSlug = idSlugs.get(example.id)
    if (existingIdSlug) {
      throw new Error(
        `Duplicate example id "${example.id}" for "${existingIdSlug}" and "${example.slug}"`,
      )
    }

    slugPaths.set(example.slug, example.relativePath)
    idSlugs.set(example.id, example.slug)
  }

  return examples
}

export function humanizeExampleSlug(slug: string) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(' ')
}

export function toExampleId(slug: string) {
  return slug.replace(/-([a-z0-9])/g, (_, letter: string) => letter.toUpperCase())
}

function createDiscoveredExampleFile(absolutePath: string): DiscoveredExampleFile {
  let relativePath = path.relative(EXAMPLES_DIRECTORY, absolutePath).split(path.sep).join('/')
  let slug = path.basename(relativePath, '.tsx')

  return {
    absolutePath,
    assetHref: `/assets/examples/${relativePath.replace(/\.tsx$/, '.js')}`,
    contentPath: `/examples/${slug}/content`,
    id: toExampleId(slug),
    importHref: url.pathToFileURL(absolutePath).href,
    path: `/examples/${slug}`,
    relativePath,
    slug,
  }
}

function shouldIgnoreEntry(name: string) {
  return (
    name.startsWith('.') ||
    name.startsWith('_') ||
    name.endsWith('.test.tsx') ||
    name === 'controller.tsx' ||
    name === 'index.tsx' ||
    name === 'view.tsx'
  )
}

function walkExampleFiles(directory: string): string[] {
  let files: string[] = []

  for (let entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (shouldIgnoreEntry(entry.name)) continue

    let absolutePath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...walkExampleFiles(absolutePath))
      continue
    }

    if (!entry.isFile() || !entry.name.endsWith('.tsx')) continue
    files.push(absolutePath)
  }

  return files
}
