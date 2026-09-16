import * as path from 'node:path'
import { createController } from 'remix/router'

import { routes } from '../routes.ts'
import { assets, workerAssets } from '../utils/assets.ts'
import { HomePage } from './home-page.tsx'

const entryFilePath = path.resolve(import.meta.dirname, './public/entry.ts')
const styleFilePath = path.resolve(import.meta.dirname, './public/styles/app.css')
const imageFilePath = path.resolve(import.meta.dirname, './public/images/image.svg')
const workerFilePath = path.resolve(import.meta.dirname, '../workers/public/entry.ts')

export default createController(routes, {
  actions: {
    async home({ render }) {
      let [scriptEntry, imageUrl, styleUrl, workerUrl, transformedImageUrl] = await Promise.all([
        assets.getScriptEntry(entryFilePath),
        assets.getHref(imageFilePath),
        assets.getHref(styleFilePath),
        workerAssets.getHref(workerFilePath),
        assets.getHref(imageFilePath, {
          transform: [['recolor', '#8B5CF6']],
        }),
      ])

      return render(
        <HomePage
          imageUrl={imageUrl}
          scriptEntry={scriptEntry}
          styleUrl={styleUrl}
          transformedImageUrl={transformedImageUrl}
          workerUrl={workerUrl}
        />,
      )
    },
    async assets({ request }) {
      let assetResponse = await assets.fetch(request)
      return assetResponse ?? new Response('Not found', { status: 404 })
    },
    async workerAssets({ request }) {
      let assetResponse = await workerAssets.fetch(request)
      return assetResponse ?? new Response('Not found', { status: 404 })
    },
  },
})
