import { createAssetServer, createFsFileCache, defineFileTransform } from 'remix/assets'
import { loadConfig } from 'remix/cli'
import sharp from 'sharp'

const config = await loadConfig(import.meta.dirname)
if (config.assets === undefined) throw new Error('Missing assets configuration')

const isDevelopment = process.env.NODE_ENV === 'development'
const maxImageWidth = 768

export const assets = createAssetServer({
  ...config.assets,
  sourceMaps: isDevelopment ? 'external' : undefined,
  minify: !isDevelopment,
  fingerprint: !isDevelopment,
  watch: false,
  files: {
    extensions: ['.webp'],
    // Resized images are computed once and kept on disk across requests and restarts. The disk cache
    // supports one process per directory, so tests, which run each file in its own process, skip it.
    cache: process.env.NODE_ENV === 'test' ? undefined : createFsFileCache(),
    transforms: {
      resize: defineFileTransform({
        extensions: ['.webp'],
        param: true,
        async transform(bytes, { param }) {
          let width = Number(param)
          if (!Number.isInteger(width) || width < 16 || width > maxImageWidth) {
            throw new TypeError(`Expected an image width from 16 to ${maxImageWidth}`)
          }

          return sharp(bytes).resize(width).webp({ quality: 78 }).toBuffer()
        },
      }),
    },
  },
})
