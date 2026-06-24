import * as path from 'node:path'
import { createAssetServer } from 'remix/assets'
import { uiHmr } from 'remix/ui-hmr/browser-module-hooks'
import { assetsBase } from '../routes.ts'

const isDevelopment = process.env.NODE_ENV === 'development'

export const assetServer = createAssetServer({
  basePath: assetsBase,
  rootDir: path.resolve(import.meta.dirname, '../../../..'),
  allow: ['demos/bookstore/app/assets/**', 'demos/bookstore/app/routes.ts', 'packages/*/src/**'],
  fileMap: {
    '/app/*path': 'demos/bookstore/app/*path',
    '/packages/*path': 'packages/*path',
  },
  ...(isDevelopment
    ? {
        hmr: async () => (await import('remix/node-hmr/runtime')).createBrowserHmrChannel(),
        scripts: { moduleHooks: [uiHmr()] },
        sourceMaps: 'external',
      }
    : {
        minify: true,
        fingerprint: { buildId: process.env.GITHUB_SHA || String(Date.now()) },
        watch: false,
      }),
})
