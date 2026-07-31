import * as path from 'node:path'
import { createAssetServer as createRemixAssetServer } from 'remix/assets'
import type { AssetServer } from 'remix/assets'
import { getVersionPathname } from './routes.ts'

const docsDir = path.resolve(import.meta.dirname, '..', '..')
const nodeEnv = process.env.NODE_ENV ?? 'production'
const isDevelopment = nodeEnv === 'development'
const isProduction = nodeEnv === 'production'

export const CLIENT_ENTRY_PATH = path.join(docsDir, 'src', 'client', 'entry.tsx')
export const STYLESHEET_PATH = path.join(docsDir, 'src', 'styles', 'docs.css')

export type DocsAssetServer = AssetServer

export function createAssetServer(version?: string): DocsAssetServer {
  return createRemixAssetServer({
    basePath: version ? `${getVersionPathname(version)}/assets` : '/assets',
    rootDir: path.resolve(docsDir, '..', '..'),
    allowFiles: [
      'docs/api/build/demos/**',
      'docs/api/src/client/**',
      'docs/api/src/styles/**',
      'docs/shared/**',
    ],
    allowPackages: ['remix'],
    fileMap: {
      '/demos/*path': 'docs/api/build/demos/*path',
      '/pkg/:pkg/src/*path': 'packages/:pkg/src/*path',
      '/pkg/:pkg/deps/*path': 'packages/:pkg/node_modules/*path',
      '/client/*path': 'docs/api/src/client/*path',
      '/styles/*path': 'docs/api/src/styles/*path',
      '/docs-shared/*path': 'docs/shared/*path',
    },
    sourceMaps: isDevelopment ? 'external' : undefined,
    minify: isProduction,
    fingerprint: isProduction
      ? { buildId: process.env.GITHUB_SHA || String(Date.now()) }
      : undefined,
    watch: false,
    scripts: {
      define: {
        'process.env.NODE_ENV': JSON.stringify(nodeEnv),
      },
    },
  })
}
