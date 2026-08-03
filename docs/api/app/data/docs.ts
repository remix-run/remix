import * as fs from 'node:fs'
import * as path from 'node:path'

import { discoverDemoFiles } from './demos.tsx'
import { discoverMarkdownFiles, type DocFile as MarkdownDocFile } from './markdown.ts'
import { buildRegistry, type DocFile, type DocsRegistry } from './registry.ts'
import type { DocsAssetServer } from '../utils/assets.ts'

const apiDir = path.resolve(import.meta.dirname, '..', '..')
const repoDir = path.resolve(apiDir, '..', '..')
const markdownDir = path.join(apiDir, 'build', 'md')
const remixPackageJson = path.join(repoDir, 'packages', 'remix', 'package.json')

export type Versions = string[]

export interface DocsContext {
  docFiles: DocFile[]
  docFilesLookup: Map<string, MarkdownDocFile>
  getRegistry(version?: string): DocsRegistry
}

export function getDefaultVersions(): Versions {
  let version = JSON.parse(fs.readFileSync(remixPackageJson, 'utf-8')).version
  return [version]
}

export function createDocsContextLoader(
  assetServer: DocsAssetServer,
  docsContext?: DocsContext,
): () => Promise<DocsContext> {
  let docsContextPromise = docsContext ? Promise.resolve(docsContext) : undefined

  return function getDocsContext(): Promise<DocsContext> {
    docsContextPromise ??= loadDocsContext(assetServer)
    return docsContextPromise
  }
}

async function loadDocsContext(assetServer: DocsAssetServer): Promise<DocsContext> {
  let { docFiles: markdownFiles, docFilesLookup } = await discoverMarkdownFiles(markdownDir)
  let demoFiles = await discoverDemoFiles(assetServer)
  let docFiles = [...markdownFiles, ...demoFiles].sort((a, b) => a.urlPath.localeCompare(b.urlPath))
  let registryByVersion = new Map<string | undefined, DocsRegistry>()
  registryByVersion.set(undefined, buildRegistry(docFiles))

  return {
    docFiles,
    docFilesLookup,
    getRegistry(version?: string): DocsRegistry {
      let registry = registryByVersion.get(version)
      if (!registry) {
        registry = buildRegistry(docFiles, version)
        registryByVersion.set(version, registry)
      }
      return registry
    },
  }
}
