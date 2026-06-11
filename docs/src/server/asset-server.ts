import * as path from 'node:path'
import { createAssetServer } from 'remix/assets'

const DOCS_DIR = path.resolve(import.meta.dirname, '..', '..')
const REPO_DIR = path.resolve(DOCS_DIR, '..')
const ENTRY_PATH = path.join(DOCS_DIR, 'src', 'client', 'entry.tsx')

export const assetServer = createAssetServer({
  rootDir: REPO_DIR,
  basePath: '/assets',
  fileMap: {
    '/demos/*path': 'docs/build/demos/*path',
    '/pkg/*path': 'packages/*path',
    '/client/*path': 'docs/src/client/*path',
    '/shared/*path': 'docs/src/shared/*path',
  },
  allow: ['docs/build/demos/**', 'docs/src/client/**', 'docs/src/shared/**', 'packages/**'],
  watch: process.env.NODE_ENV !== 'production',
})

// Transitive deps of the client entry. Emitted as <link rel="modulepreload">
// on every page so the prerender spider materializes them into the static
// output (and browsers warm the cache).
export const entryPreloads: readonly string[] = await assetServer.getPreloads(ENTRY_PATH)
