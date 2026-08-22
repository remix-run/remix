import * as path from 'node:path'
import { createAssetServer as createRemixAssetServer } from 'remix/assets'
import type { AssetServer } from 'remix/assets'

import { getVersionPathname } from './routes.ts'

const nodeEnv = process.env.NODE_ENV ?? 'production'
const isDevelopment = nodeEnv === 'development'
const isProduction = nodeEnv === 'production'

export type DocsAssetServer = AssetServer

export function createAssetServer(version?: string): DocsAssetServer {
  return createRemixAssetServer({
    basePath: version ? `${getVersionPathname(version)}/assets` : '/assets',
    rootDir: path.resolve(import.meta.dirname, '../../..'),
    allowFiles: [
      'docs/api/build/demos/**',
      'docs/api/app/routes.ts',
      'docs/api/app/**/public/**',
      'docs/shared/**/public/**',
    ],
    allowPackages: ['remix'],
    denyFiles: ['**/*.test.*'],
    fileMap: {
      '/demos/*path': 'docs/api/build/demos/*path',
      '/pkg/:pkg/src/*path': 'packages/:pkg/src/*path',
      '/pkg/:pkg/deps/*path': 'packages/:pkg/node_modules/*path',
      '/app/*path': 'docs/api/app/*path',
      '/docs-shared/*path': 'docs/shared/*path',
    },
    sourceMaps: isDevelopment ? 'external' : undefined,
    minify: isProduction,
    fingerprint: isProduction,
    watch: false,
    scripts: {
      define: {
        'process.env.NODE_ENV': JSON.stringify(nodeEnv),
      },
    },
  })
}
