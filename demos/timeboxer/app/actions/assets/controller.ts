import * as path from 'node:path'
import { createAssetServer } from 'remix/assets'
import { createController } from 'remix/router'

import { routes } from '../../routes.ts'

export const assetServer = createAssetServer({
  basePath: '/assets',
  rootDir: path.resolve(import.meta.dirname, '../../../../..'),
  mounts: {
    app: 'demos/timeboxer/app',
    packages: 'packages',
  },
  allowFiles: ['demos/timeboxer/app/routes.ts', 'demos/timeboxer/app/**/public/**'],
  allowPackages: ['remix'],
  denyFiles: ['demos/timeboxer/app/**/*.test.*'],
  sourceMaps: process.env.NODE_ENV === 'development' ? 'external' : undefined,
  scripts: {
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
    },
  },
})

export const assets = createController(routes.assets, {
  actions: {
    index: {
      async handler({ request }) {
        return (await assetServer.fetch(request)) ?? new Response('Not Found', { status: 404 })
      },
    },
  },
})
