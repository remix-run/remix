import * as path from 'node:path'
import { createAssetServer } from 'remix/assets'
import type { AssetServer } from 'remix/assets'

const DOCS_DIR = path.resolve(import.meta.dirname, '..', '..')
const REPO_DIR = path.resolve(DOCS_DIR, '..')
const ENTRY_PATH = path.join(DOCS_DIR, 'src', 'client', 'entry.tsx')

export const entryPath = ENTRY_PATH
export const assetServer = createDocsAssetServer('/assets')

const versionedAssetServers = new Map<string, AssetServer>()

// Transitive deps of the client entry. Emitted as <link rel="modulepreload">
// on every page so the prerender spider materializes them into the static
// output (and browsers warm the cache).
export const defaultPreloads: readonly string[] = await getAssetServer().getPreloads(ENTRY_PATH)

function createDocsAssetServer(basePath: string): AssetServer {
  return createAssetServer({
    rootDir: REPO_DIR,
    basePath,
    fileMap: {
      '/demos/*path': 'docs/build/demos/*path',
      '/pkg/*path': 'packages/*path',
      '/client/*path': 'docs/src/client/*path',
      '/shared/*path': 'docs/src/shared/*path',
    },
    allow: ['docs/build/demos/**', 'docs/src/client/**', 'docs/src/shared/**', 'packages/**'],
    watch: process.env.NODE_ENV !== 'production',
  })
}

export function getAssetServer(version?: string): AssetServer {
  if (!version) return assetServer

  let server = versionedAssetServers.get(version)
  if (!server) {
    server = createDocsAssetServer(`/${version}/assets`)
    versionedAssetServers.set(version, server)
  }
  return server
}

export async function closeAssetServers(): Promise<void> {
  await Promise.all([
    assetServer.close(),
    ...Array.from(versionedAssetServers.values(), (server) => server.close()),
  ])
  versionedAssetServers.clear()
}
