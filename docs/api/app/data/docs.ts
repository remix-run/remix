import * as path from 'node:path'

import { discoverDemoFiles } from './demos.tsx'
import { discoverMarkdownFiles, type DocFile as MarkdownDocFile } from './markdown.ts'
import { buildRegistry, type DocFile, type DocsRegistry } from './registry.ts'

const apiDir = path.resolve(import.meta.dirname, '..', '..')
const markdownDir = path.join(apiDir, 'build', 'md')

export interface DocsContext {
  docFiles: DocFile[]
  docFilesLookup: Map<string, MarkdownDocFile>
  registry: DocsRegistry
}

export function createDocsContextLoader(docsContext?: DocsContext): () => Promise<DocsContext> {
  let docsContextPromise = docsContext ? Promise.resolve(docsContext) : undefined

  return function getDocsContext(): Promise<DocsContext> {
    docsContextPromise ??= loadDocsContext()
    return docsContextPromise
  }
}

async function loadDocsContext(): Promise<DocsContext> {
  let { docFiles: markdownFiles, docFilesLookup } = await discoverMarkdownFiles(markdownDir)
  let demoFiles = await discoverDemoFiles()
  let docFiles = [...markdownFiles, ...demoFiles].sort((a, b) => a.urlPath.localeCompare(b.urlPath))
  return { docFiles, docFilesLookup, registry: buildRegistry(docFiles) }
}
