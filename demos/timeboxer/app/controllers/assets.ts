import * as path from 'node:path'
import { createAssetServer } from 'remix/assets'
import { createController } from 'remix/fetch-router'

import { routes } from '../routes.ts'

export const assetServer = createAssetServer({
  basePath: '/assets',
  rootDir: path.resolve(import.meta.dirname, '../../../..'),
  fileMap: {
    '/app/*path': 'demos/timeboxer/app/*path',
    '/packages/*path': 'packages/*path',
  },
  allowFiles: [
    'demos/timeboxer/app/assets/**',
    'demos/timeboxer/app/routes.ts',
    'demos/timeboxer/app/ui/**',
  ],
  allowPackages: ['remix'],
  denyFiles: ['demos/timeboxer/app/**/*.server.*'],
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
