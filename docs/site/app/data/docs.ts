import * as path from 'node:path'

import { loadDocsNavigationItems } from '../actions/guides/markdown-chapters.tsx'
import { discoverDemoFiles } from './demos.tsx'
import { discoverMarkdownFiles, type DocFile as MarkdownDocFile } from './markdown.ts'
import { buildRegistry, type DocFile, type DocsRegistry } from './registry.ts'

const siteDir = path.resolve(import.meta.dirname, '..', '..')
const markdownDir = path.join(siteDir, 'build', 'md')

export interface DocsContext {
  docFiles: DocFile[]
  docFilesLookup: Map<string, MarkdownDocFile>
  registry: DocsRegistry
}

export type DocsContextLoader = () => Promise<DocsContext>

export function createDocsContextLoader(docsContext?: DocsContext): DocsContextLoader {
  let docsContextPromise = docsContext ? Promise.resolve(docsContext) : undefined

  return function getDocsContext(): Promise<DocsContext> {
    docsContextPromise ??= loadDocsContext()
    return docsContextPromise
  }
}

async function loadDocsContext(): Promise<DocsContext> {
  let [{ docFiles: markdownFiles, docFilesLookup }, demoFiles, guides] = await Promise.all([
    discoverMarkdownFiles(markdownDir),
    discoverDemoFiles(),
    loadDocsNavigationItems(),
  ])
  let docFiles = [...markdownFiles, ...demoFiles].sort((a, b) => a.urlPath.localeCompare(b.urlPath))
  return { docFiles, docFilesLookup, registry: buildRegistry(docFiles, guides) }
}
