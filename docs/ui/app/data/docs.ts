import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type {
  UiDocs,
  UiDocsExample,
  UiDocsSection,
} from '../../../../packages/ui/src/docs/types.ts'

export const uiSourceDir = path.resolve(import.meta.dirname, '../../../../packages/ui/src')

export async function loadDocs(): Promise<UiDocs[]> {
  let pages: UiDocs[] = []
  let paths = []
  for await (let filename of fs.glob('**/*.docs.tsx', { cwd: uiSourceDir })) paths.push(filename)
  for (let filename of paths.sort()) {
    let moduleUrl = pathToFileURL(path.join(uiSourceDir, filename))
    let mod: unknown = await import(moduleUrl.href)
    if (!isRecord(mod) || !isUiDocs(mod.default)) {
      throw new Error(`Invalid UI docs definition: ${filename}`)
    }
    let docs = mod.default
    let ids = [...docs.examples, ...(docs.sections ?? [])].map((section) => section.id)
    if (new Set(ids).size !== ids.length) throw new Error(`Duplicate section ID in ${filename}`)
    if (pages.some((page) => page.category === docs.category && page.slug === docs.slug)) {
      throw new Error(`Duplicate UI docs page: ${docs.category}/${docs.slug}`)
    }
    for (let example of docs.examples) {
      if (example.section && !docs.sections?.some((section) => section.id === example.section)) {
        throw new Error(`Unknown example section in ${filename}: ${example.section}`)
      }
      let relativePath = path.relative(uiSourceDir, fileURLToPath(example.module))
      if (
        relativePath.startsWith('..') ||
        path.isAbsolute(relativePath) ||
        !relativePath.endsWith('.example.tsx')
      ) {
        throw new Error(
          `Example must be a .example.tsx file inside packages/ui/src: ${example.module}`,
        )
      }
    }
    pages.push(docs)
  }
  return pages.sort((a, b) => a.title.localeCompare(b.title))
}

export function isUiDocs(value: unknown): value is UiDocs {
  return (
    isRecord(value) &&
    typeof value.title === 'string' &&
    value.title.length > 0 &&
    typeof value.slug === 'string' &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.slug) &&
    (value.category === 'primitives' || value.category === 'animation') &&
    typeof value.description === 'string' &&
    typeof value.importPath === 'string' &&
    Array.isArray(value.examples) &&
    value.examples.every(isExample) &&
    (value.sections === undefined ||
      (Array.isArray(value.sections) && value.sections.every(isSection)))
  )
}

function isExample(value: unknown): value is UiDocsExample {
  return (
    isRecord(value) &&
    isId(value.id) &&
    typeof value.title === 'string' &&
    typeof value.description === 'string' &&
    value.module instanceof URL &&
    value.module.protocol === 'file:' &&
    value.module.hash === '' &&
    value.module.search === '' &&
    (value.section === undefined || isId(value.section)) &&
    (value.previewSize === undefined || value.previewSize === 'compact')
  )
}

function isSection(value: unknown): value is UiDocsSection {
  return (
    isRecord(value) &&
    isId(value.id) &&
    typeof value.title === 'string' &&
    typeof value.content === 'function' &&
    (value.code === undefined ||
      (Array.isArray(value.code) &&
        value.code.every(
          (code) =>
            isRecord(code) &&
            typeof code.source === 'string' &&
            (code.language === undefined || typeof code.language === 'string'),
        )))
  )
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object'
}
