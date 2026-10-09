import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'

import { loadModule } from 'remix/node-tsx/load-module'
import { parse } from 'yaml'

import { getRemixReadmeMappings, rewriteLinksToRemixReadmes } from './remix-readmes.ts'

const rootDir = path.resolve(import.meta.dirname, '..', '..')
const defaultSourceGuidesDir = path.join(
  rootDir,
  'docs',
  'guides',
  'app',
  'actions',
  'docs',
  'chapters',
)
const defaultRemixGuidesDir = path.join(rootDir, 'packages', 'remix', 'guides')
const chapterMarkdownModulePath = path.join(
  rootDir,
  'docs',
  'guides',
  'app',
  'actions',
  'docs',
  'markdown',
  'chapter-markdown.ts',
)

export interface RemixGuideCopy {
  title: string
  description: string
  sourceGuidePath: string
  remixGuidePath: string
}

interface RemixGuide extends RemixGuideCopy {
  published: boolean
}

interface RemixGuideDirectories {
  sourceGuidesDir?: string
  remixGuidesDir?: string
}

export function getRemixGuideCopies(directories: RemixGuideDirectories = {}): RemixGuideCopy[] {
  return getPublishedGuideCopies(getRemixGuides(directories))
}

function getRemixGuides({
  sourceGuidesDir = defaultSourceGuidesDir,
  remixGuidesDir = defaultRemixGuidesDir,
}: RemixGuideDirectories = {}): RemixGuide[] {
  return fs
    .readdirSync(sourceGuidesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^\d+-[a-z0-9][a-z0-9-]*\.md$/.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry): RemixGuide => {
      let sourceGuidePath = path.join(sourceGuidesDir, entry.name)
      let { title, description, published } = readGuideMetadata(sourceGuidePath)
      return {
        title,
        description,
        published,
        sourceGuidePath,
        remixGuidePath: path.join(remixGuidesDir, entry.name),
      }
    })
}

function getPublishedGuideCopies(guides: RemixGuide[]): RemixGuideCopy[] {
  return guides
    .filter((guide) => guide.published)
    .map(({ title, description, sourceGuidePath, remixGuidePath }) => ({
      title,
      description,
      sourceGuidePath,
      remixGuidePath,
    }))
}

export async function syncRemixGuides({
  sourceGuidesDir = defaultSourceGuidesDir,
  remixGuidesDir = defaultRemixGuidesDir,
}: RemixGuideDirectories = {}): Promise<RemixGuideCopy[]> {
  let guides = getRemixGuides({ sourceGuidesDir, remixGuidesDir })
  let copies = getPublishedGuideCopies(guides)
  let readmeMappings = getRemixReadmeMappings()
  let renderChapterMarkdown = await loadRenderChapterMarkdown()

  await fsp.rm(remixGuidesDir, { recursive: true, force: true })
  await fsp.mkdir(remixGuidesDir, { recursive: true })
  await Promise.all(
    copies.map(async (copy) => {
      let markdown = await fsp.readFile(copy.sourceGuidePath, 'utf-8')
      let installedMarkdown = rewriteLinksToRemixReadmes(
        await renderChapterMarkdown(markdown),
        copy.remixGuidePath,
        readmeMappings,
      )
      await fsp.writeFile(copy.remixGuidePath, installedMarkdown)
    }),
  )
  return copies
}

// Installed guides use the same markdown as the website's `/<chapter>.md` routes, so
// `::frame` directives are replaced with demo source (or omitted) rather than copied
// verbatim. The renderer lives in the guides app and imports `.tsx` example modules.
async function loadRenderChapterMarkdown(): Promise<(source: string) => Promise<string>> {
  let mod = await loadModule(chapterMarkdownModulePath, import.meta.url)
  if (!isRecord(mod) || typeof mod.renderChapterMarkdown !== 'function') {
    throw new Error(`${chapterMarkdownModulePath} must export renderChapterMarkdown()`)
  }

  let renderChapterMarkdown = mod.renderChapterMarkdown
  return async (source) => {
    let markdown: unknown = await renderChapterMarkdown(source)
    if (typeof markdown !== 'string') {
      throw new Error('renderChapterMarkdown() must return a string')
    }
    return markdown
  }
}

function readGuideMetadata(filePath: string): {
  title: string
  description: string
  published: boolean
} {
  let markdown = fs.readFileSync(filePath, 'utf-8')
  let frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown)?.[1]
  if (!frontmatter) {
    throw new Error(`${filePath} must start with YAML frontmatter`)
  }

  let metadata: unknown = parse(frontmatter)
  if (!isRecord(metadata)) {
    throw new Error(`${filePath} must have an object in its YAML frontmatter`)
  }

  let { title, description, published } = metadata
  if (typeof title !== 'string' || !title.trim()) {
    throw new Error(`${filePath} must have a non-empty frontmatter title`)
  }
  if (typeof description !== 'string' || !description.trim()) {
    throw new Error(`${filePath} must have a non-empty frontmatter description`)
  }
  if (published !== undefined && typeof published !== 'boolean') {
    throw new Error(`${filePath} must have a boolean frontmatter published value when present`)
  }

  return { title: title.trim(), description: description.trim(), published: published ?? true }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
