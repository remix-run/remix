import * as path from 'node:path'
import { createAssetServer, defineFileTransform, type AssetServerOptions } from 'remix/assets'
import { loadConfig } from 'remix/cli'
import { createFsFileStorage } from 'remix/file-storage/fs'
import { optimize as optimizeSvg } from 'svgo'
import { workerAssetsBase } from '../routes.ts'

const isDevelopment = process.env.NODE_ENV === 'development'

const config = await loadConfig(import.meta.dirname)
if (config.assets === undefined) throw new Error('Missing assets configuration')
if (config.assets.files === undefined) throw new Error('Missing asset file configuration')

const baseOptions = {
  ...config.assets,
  files: config.assets.files,
  sourceMaps: isDevelopment ? 'external' : undefined,
  minify: !isDevelopment,
  watch: isDevelopment,
  fingerprint: !isDevelopment,
} satisfies AssetServerOptions

export const assets = createAssetServer({
  ...baseOptions,
  files: {
    ...baseOptions.files,
    cache: createFsFileStorage(path.resolve(import.meta.dirname, '../../.tmp/assets-cache')),
    globalTransforms: [
      {
        extensions: ['.svg'],
        async transform(bytes) {
          let svg = new TextDecoder().decode(bytes)
          return optimizeSvg(svg, { multipass: true }).data
        },
      },
    ],
    transforms: {
      recolor: defineFileTransform({
        extensions: ['.svg'],
        param: true,
        async transform(bytes, { param }) {
          if (!/^#?(?:[\da-f]{3,4}|[\da-f]{6}(?:[\da-f]{2})?)$/i.test(param)) {
            throw new TypeError('Expected a hex color, with or without a leading #')
          }

          let svg = new TextDecoder().decode(bytes)
          return svg.replaceAll('currentColor', `${!param.startsWith('#') ? '#' : ''}${param}`)
        },
      }),
    },
  },
})

export const workerAssets = createAssetServer({
  ...baseOptions,
  basePath: workerAssetsBase,
  importMaps: false,
})
