import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'

import { parse } from 'yaml'

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

export interface RemixGuideCopy {
  title: string
  description: string
  sourceGuidePath: string
  remixGuidePath: string
}

interface RemixGuide extends RemixGuideCopy {
  href: string
  published: boolean
}

interface RemixGuideDirectories {
  sourceGuidesDir?: string
  remixGuidesDir?: string
}

export function getRemixGuideCopies({
  sourceGuidesDir = defaultSourceGuidesDir,
  remixGuidesDir = defaultRemixGuidesDir,
}: RemixGuideDirectories = {}): RemixGuideCopy[] {
  let guides = fs
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
        href: `/${entry.name.replace(/^\d+-|\.md$/g, '')}/`,
        sourceGuidePath,
        remixGuidePath: path.join(remixGuidesDir, entry.name),
      }
    })

  validatePublishedGuideLinks(guides)
  return guides
    .filter((guide) => guide.published)
    .map(({ title, description, sourceGuidePath, remixGuidePath }) => ({
      title,
      description,
      sourceGuidePath,
      remixGuidePath,
    }))
}

export async function syncRemixGuides(): Promise<RemixGuideCopy[]> {
  let copies = getRemixGuideCopies()
  await removeRemixGuides()

  await fsp.mkdir(defaultRemixGuidesDir, { recursive: true })
  await Promise.all(copies.map((copy) => fsp.copyFile(copy.sourceGuidePath, copy.remixGuidePath)))
  return copies
}

async function removeRemixGuides(): Promise<void> {
  await fsp.rm(defaultRemixGuidesDir, { recursive: true, force: true })
}

function validatePublishedGuideLinks(guides: RemixGuide[]): void {
  let unpublishedGuides = new Map(
    guides.filter((guide) => !guide.published).map((guide) => [guide.href, guide]),
  )
  let invalidLinks: string[] = []

  for (let guide of guides) {
    if (!guide.published) continue

    let markdown = fs.readFileSync(guide.sourceGuidePath, 'utf-8')
    let linkPattern = /(?:\]\(\s*|^\s*\[[^\]\r\n]+\]:\s*)<?(\/(?!\/)[^\s)>]+)/gm
    for (let match of markdown.matchAll(linkPattern)) {
      let href = match[1].split(/[?#]/, 1)[0]
      let normalizedHref = href.endsWith('/') ? href : `${href}/`
      let unpublishedGuide = unpublishedGuides.get(normalizedHref)
      if (!unpublishedGuide) continue

      let line = markdown.slice(0, match.index).split('\n').length
      invalidLinks.push(
        `${guide.sourceGuidePath}:${line} links to unpublished guide "${unpublishedGuide.title}" (${href})`,
      )
    }
  }

  if (invalidLinks.length > 0) {
    throw new Error(
      `Published guides must not link to unpublished guides:\n${invalidLinks.join('\n')}`,
    )
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
