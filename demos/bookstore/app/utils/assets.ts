import { createAssetServer, createFsFileCache, defineFileTransform } from 'remix/assets'
import { loadConfig } from 'remix/cli'
import { componentHmr } from 'remix/component-hmr/assets'
import sharp from 'sharp'

const config = await loadConfig(import.meta.dirname)
if (config.assets === undefined) throw new Error('Missing assets configuration')
if (config.assets.files === undefined) throw new Error('Missing asset file configuration')

const isDevelopment = process.env.NODE_ENV === 'development'
const isHmr = Boolean(isDevelopment && process.env.REMIX_NODE_HMR)

export const bookImageWidths = [320, 480, 640, 768, 960] as const

export const browserHmrChannel = isHmr
  ? await (await import('remix/node-hmr/runtime')).createBrowserHmrChannel()
  : undefined

export const assets = createAssetServer({
  ...config.assets,
  sourceMaps: isDevelopment ? 'external' : undefined,
  minify: !isDevelopment,
  fingerprint: !isDevelopment,
  watch: isHmr,
  files: {
    ...config.assets.files,
    // Test workers each need their own file-cache directory.
    cache: createFsFileCache(
      process.env.NODE_ENV === 'test'
        ? { directory: `node_modules/.cache/remix/assets/test-${process.pid}` }
        : undefined,
    ),
    transforms: {
      // Each width produces its matching key; Object.fromEntries erases those literal keys.
      ...(Object.fromEntries(
        bookImageWidths.map((width) => [`book-image-${width}`, createBookImageTransform(width)]),
      ) as Record<
        `book-image-${(typeof bookImageWidths)[number]}`,
        ReturnType<typeof createBookImageTransform>
      >),
      'book-thumbnail': defineFileTransform({
        extensions: ['.png'],
        async transform(bytes) {
          return {
            content: await sharp(bytes)
              .resize({ width: 96, height: 128, fit: 'cover', withoutEnlargement: true })
              .webp({ quality: 75 })
              .toBuffer(),
            extension: '.webp',
          }
        },
      }),
    },
  },
  hmr: browserHmrChannel
    ? {
        channel: () => browserHmrChannel,
        moduleImporter: 'remix/multiple-import-maps-polyfill',
      }
    : undefined,
  scripts: {
    loaders: isHmr ? [componentHmr()] : undefined,
  },
})

function createBookImageTransform(width: number) {
  return defineFileTransform({
    extensions: ['.png'],
    async transform(bytes) {
      return {
        content: await sharp(bytes)
          .resize({ width, withoutEnlargement: true })
          .webp({ quality: 75 })
          .toBuffer(),
        extension: '.webp',
      }
    },
  })
}
