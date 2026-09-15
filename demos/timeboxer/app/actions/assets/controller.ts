import * as path from 'node:path'

import { createAssetServer } from 'remix/assets'
import { loadConfig } from 'remix/cli'
import { createController } from 'remix/router'

import { routes } from '../../routes.ts'

const config = await loadConfig(import.meta.dirname)
if (config.assets === undefined) throw new Error('Missing assets configuration')

const isDevelopment = process.env.NODE_ENV === 'development'

export const assetServer = createAssetServer({
  ...config.assets,
  sourceMaps: isDevelopment ? 'external' : undefined,
  minify: !isDevelopment,
  fingerprint: !isDevelopment,
  watch: false,
  scripts: {
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
    },
  },
})

export const scriptEntry = await assetServer.getScriptEntry(
  path.resolve(import.meta.dirname, '../public/entry.ts'),
)

export const assets = createController(routes.assets, {
  actions: {
    index: {
      async handler({ request }) {
        return (await assetServer.fetch(request)) ?? new Response('Not Found', { status: 404 })
      },
    },
  },
})
