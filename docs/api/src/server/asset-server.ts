import * as path from 'node:path'
import { createAssetServer as createRemixAssetServer } from 'remix/assets'
import type { AssetServer } from 'remix/assets'

const DOCS_DIR = path.resolve(import.meta.dirname, '..', '..')
const REPO_DIR = path.resolve(DOCS_DIR, '..', '..')
export const CLIENT_ENTRY_PATH = path.join(DOCS_DIR, 'src', 'client', 'entry.tsx')
export const TABLE_OF_CONTENTS_ENTRY_PATH = path.join(
  DOCS_DIR,
  'src',
  'client',
  'table-of-contents.browser.tsx',
)

export type DocsAssetServer = AssetServer

export function createAssetServer(version?: string): DocsAssetServer {
  return createRemixAssetServer({
    rootDir: REPO_DIR,
    basePath: version ? `/${version}/assets` : '/assets',
    fileMap: {
      '/demos/*path': 'docs/api/build/demos/*path',
      '/pkg/:pkg/src/*path': 'packages/:pkg/src/*path',
      '/pkg/:pkg/deps/*path': 'packages/:pkg/node_modules/*path',
      '/client/*path': 'docs/api/src/client/*path',
      '/shared/*path': 'docs/api/src/shared/*path',
    },
    allow: [
      'docs/api/build/demos/**',
      'docs/api/src/client/**',
      'docs/api/src/shared/**',
      'packages/**',
    ],
    watch: process.env.NODE_ENV !== 'production',
  })
}
