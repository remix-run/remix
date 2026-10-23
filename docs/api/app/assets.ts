import * as path from 'node:path'
import { createAssetServer as createRemixAssetServer } from 'remix/assets'
import type { AssetServer } from 'remix/assets'
import { docsAssetHmrOptions } from 'remix-docs-shared/hmr/assets'

import { getVersionPathname } from './routes.ts'

const nodeEnv = process.env.NODE_ENV ?? 'production'
const isDevelopment = nodeEnv === 'development'
const isProduction = nodeEnv === 'production'

export type DocsAssetServer = AssetServer

export function createAssetServer(version?: string): DocsAssetServer {
  let { hmr, scriptLoaders, watch } = docsAssetHmrOptions

  return createRemixAssetServer({
    basePath: version ? `${getVersionPathname(version)}/assets` : '/assets',
    rootDir: path.resolve(import.meta.dirname, '../../..'),
    allowFiles: [
      'docs/api/build/demos/**',
      'docs/api/app/routes.ts',
      'docs/api/app/**/public/**',
      'docs/shared/**/public/**',
    ],
    allowPackages: ['@remix-run/ui', 'remix'],
    denyFiles: ['**/*.test.*'],
    mounts: {
      app: 'docs/api/app',
      demos: 'docs/api/build/demos',
      'docs-shared': 'docs/shared',
      npm: 'node_modules',
      packages: 'packages',
    },
    sourceMaps: isDevelopment ? 'external' : undefined,
    minify: isProduction,
    fingerprint: isProduction,
    watch,
    hmr,
    scripts: {
      define: {
        'process.env.NODE_ENV': JSON.stringify(nodeEnv),
      },
      loaders: scriptLoaders,
    },
  })
}
