import * as path from 'node:path'
import { createAssetServer as createRemixAssetServer } from 'remix/assets'
import type { AssetServer } from 'remix/assets'

const DOCS_DIR = path.resolve(import.meta.dirname, '..', '..')
const REPO_DIR = path.resolve(DOCS_DIR, '..')
export const CLIENT_ENTRY_PATH = path.join(DOCS_DIR, 'src', 'client', 'entry.tsx')

export type DocsAssetServer = AssetServer

export function createAssetServer(version?: string): DocsAssetServer {
  return createRemixAssetServer({
    rootDir: REPO_DIR,
    basePath: version ? `/${version}/assets` : '/assets',
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
