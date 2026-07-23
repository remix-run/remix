import * as path from 'node:path'

import { createAssetServer } from 'remix/assets'

import { assetsBase } from '../routes.ts'

const nodeEnv = process.env.NODE_ENV ?? 'development'
const isDevelopment = nodeEnv === 'development'
const isProduction = nodeEnv === 'production'
const rootDir = path.resolve(import.meta.dirname, '../../..')

export const assets = createAssetServer({
  basePath: assetsBase,
  rootDir,
  fileMap: {
    '/app/*path': 'guides/app/*path',
    '/packages/*path': 'packages/*path',
  },
  allowFiles: [
    'guides/app/routes.ts',
    'guides/app/**/*.browser.ts?(x)',
    'guides/app/**/*.demo.ts?(x)',
    'guides/app/styles/**/*.css',
  ],
  allowPackages: ['remix'],
  sourceMaps: isDevelopment ? 'external' : undefined,
  minify: isProduction,
  fingerprint: isProduction ? { buildId: process.env.GITHUB_SHA || String(Date.now()) } : undefined,
  watch: isDevelopment,
  scripts: {
    define: {
      'process.env.NODE_ENV': JSON.stringify(nodeEnv),
    },
  },
})
