import { createAssetServer, createFsFileCache, defineFileTransform } from 'remix/assets'
import { loadConfig } from 'remix/cli'
import { optimize as optimizeSvg } from 'svgo'

const config = await loadConfig(import.meta.dirname)
if (config.assets === undefined) throw new Error('Missing assets configuration')
if (config.assets.files === undefined) throw new Error('Missing asset file configuration')

const isDevelopment = process.env.NODE_ENV === 'development'

export const assetServer = createAssetServer({
  ...config.assets,
  files: {
    ...config.assets.files,
    cache: createFsFileCache(),
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
  watch: isDevelopment,
  fingerprint: !isDevelopment,
})
