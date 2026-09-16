import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'

import { getRemixGuideCopies } from './remix-guides.ts'
import { getRemixReadmeMappings } from './remix-readmes.ts'

const packagesDir = path.resolve(import.meta.dirname, '..', '..', 'packages')
const remixDir = path.join(packagesDir, 'remix')
const remixManifestPath = path.join(remixDir, 'manifest.json')

export const remixIndexPath = path.join(remixDir, 'INDEX.md')

export interface RemixIndexEntry {
  exportNames: string[]
  description: string
  docsPath: string
}

export function getRemixIndexEntries(): RemixIndexEntry[] {
  let manifest = readStringRecord(remixManifestPath)
  let packageDescriptions = readPackageDescriptions()
  let readmePaths = new Map(
    getRemixReadmeMappings().map((copy) => [
      copy.specifier,
      toPosixPath(path.relative(remixDir, copy.remixReadmePath)),
    ]),
  )
  let entriesByDocsPath = new Map<string, RemixIndexEntry>()

  for (let [exportName, specifier] of Object.entries(manifest)) {
    if (exportName.startsWith('_')) continue

    let packageName = getPackageName(specifier)
    let description = packageDescriptions.get(packageName)
    if (!description) {
      throw new Error(`${packageName} must have a non-empty package.json description`)
    }

    let docsPath = readmePaths.get(specifier)
    if (!docsPath) {
      throw new Error(`Could not find README documentation for ${exportName}`)
    }

    let existing = entriesByDocsPath.get(docsPath)
    if (existing) {
      if (existing.description !== description) {
        throw new Error(`Exports with different package descriptions link to ${docsPath}`)
      }
      existing.exportNames.push(exportName)
    } else {
      entriesByDocsPath.set(docsPath, { exportNames: [exportName], description, docsPath })
    }
  }

  return [...entriesByDocsPath.values()].sort((a, b) =>
    a.exportNames[0].localeCompare(b.exportNames[0]),
  )
}

export function createRemixIndex(): string {
  let guideRows = getRemixGuideCopies().map((guide) => {
    let guidePath = toPosixPath(path.relative(remixDir, guide.remixGuidePath))
    return `| [${escapeTableCell(guide.title)}](${guidePath}) | ${escapeTableCell(guide.description)} |`
  })
  let apiRows = getRemixIndexEntries().map((entry) => {
    let exportNames = entry.exportNames.map((exportName) => `\`${exportName}\``).join('<br>')
    return `| ${exportNames} | ${escapeTableCell(entry.description)} | ${formatDocsLink(entry.docsPath)} |`
  })

  return [
    '# Remix Documentation Index',
    '',
    'Search this generated index by task, export name, or description. Use the guides for app workflows and the package READMEs for API details that match the installed Remix version.',
    '',
    '## Guides',
    '',
    '| Guide | Description |',
    '| --- | --- |',
    ...guideRows,
    '',
    '## Package APIs',
    '',
    'Exports covered by the same README are grouped together.',
    '',
    '| Exports | Description | Docs |',
    '| --- | --- | --- |',
    ...apiRows,
    '',
  ].join('\n')
}

export async function syncRemixIndex(): Promise<void> {
  await fsp.writeFile(remixIndexPath, createRemixIndex())
}

export async function removeRemixIndex(): Promise<void> {
  await fsp.rm(remixIndexPath, { force: true })
}

function readPackageDescriptions(): Map<string, string> {
  let descriptions = new Map<string, string>()

  for (let entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue

    let packageJsonPath = path.join(packagesDir, entry.name, 'package.json')
    if (!fs.existsSync(packageJsonPath)) continue

    let packageJson: unknown = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
    if (!isRecord(packageJson)) continue

    let { name, description } = packageJson
    if (typeof name === 'string' && typeof description === 'string' && description.trim()) {
      descriptions.set(name, description.trim())
    }
  }

  return descriptions
}

function readStringRecord(filePath: string): Record<string, string> {
  let value: unknown = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  if (!isRecord(value)) {
    throw new Error(`Expected ${filePath} to contain an object of strings`)
  }

  let result: Record<string, string> = {}
  for (let [key, item] of Object.entries(value)) {
    if (typeof item !== 'string') {
      throw new Error(`Expected ${filePath} to contain an object of strings`)
    }
    result[key] = item
  }

  return result
}

function getPackageName(specifier: string): string {
  let parts = specifier.split('/')
  if (specifier.startsWith('@')) {
    let scope = parts[0]
    let name = parts[1]
    if (!scope || !name) {
      throw new Error(`Invalid package specifier: ${specifier}`)
    }
    return `${scope}/${name}`
  }

  let name = parts[0]
  if (!name) {
    throw new Error(`Invalid package specifier: ${specifier}`)
  }
  return name
}

function formatDocsLink(docsPath: string): string {
  return `[README](${docsPath})`
}

function escapeTableCell(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll(/\r?\n/g, ' ')
}

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join('/')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
