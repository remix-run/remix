import { createAssetServer } from 'remix/assets'
import { loadConfig } from 'remix/cli'
import { createController } from 'remix/router'

import { routes } from '../../routes.ts'

const config = await loadConfig(import.meta.dirname)
if (config.assets === undefined) throw new Error('Missing assets configuration')

export const assetServer = createAssetServer({
  ...config.assets,
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
