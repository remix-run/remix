import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'

import { parse } from 'yaml'

const rootDir = path.resolve(import.meta.dirname, '..', '..')
const sourceGuidesDir = path.join(rootDir, 'docs', 'guides', 'app', 'actions', 'docs', 'chapters')
const remixGuidesDir = path.join(rootDir, 'packages', 'remix', 'guides')

export interface RemixGuideCopy {
  title: string
  description: string
  sourceGuidePath: string
  remixGuidePath: string
}

export function getRemixGuideCopies(): RemixGuideCopy[] {
  return fs
    .readdirSync(sourceGuidesDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^\d+-[a-z0-9][a-z0-9-]*\.md$/.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      let sourceGuidePath = path.join(sourceGuidesDir, entry.name)
      let { title, description, published } = readGuideMetadata(sourceGuidePath)
      return published
        ? [
            {
              title,
              description,
              sourceGuidePath,
              remixGuidePath: path.join(remixGuidesDir, entry.name),
            },
          ]
        : []
    })
}

export async function syncRemixGuides(): Promise<RemixGuideCopy[]> {
  await removeRemixGuides()

  let copies = getRemixGuideCopies()
  await fsp.mkdir(remixGuidesDir, { recursive: true })
  await Promise.all(copies.map((copy) => fsp.copyFile(copy.sourceGuidePath, copy.remixGuidePath)))
  return copies
}

export async function removeRemixGuides(): Promise<void> {
  await fsp.rm(remixGuidesDir, { recursive: true, force: true })
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
