import * as path from 'node:path'
import { createAssetServer, defineFileTransform } from 'remix/assets'
import { string } from 'remix/data-schema'
import { createFsFileStorage } from 'remix/file-storage/fs'
import { optimize as optimizeSvg } from 'svgo'
import { assetsBase } from '../routes.ts'

const isDevelopment = process.env.NODE_ENV === 'development'
export const assetServer = createAssetServer({
  basePath: assetsBase,
  rootDir: path.resolve(import.meta.dirname, '../..'),
  allow: ['app/**'],
  fileMap: {
    '/app/client/*path': 'app/client/*path',
  },
  files: {
    cache: createFsFileStorage(path.resolve(import.meta.dirname, '../../.tmp/assets-cache')),
    extensions: ['.svg'],
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
        paramSchema: string()
          .refine(
            (value) => /^#?(?:[\da-f]{3,4}|[\da-f]{6}(?:[\da-f]{2})?)$/i.test(value),
            'Expected a hex color, with or without a leading #',
          )
          .transform((value) => `${!value.startsWith('#') ? '#' : ''}${value}`),
        async transform(bytes, { param }) {
          let svg = new TextDecoder().decode(bytes)
          return svg.replaceAll('currentColor', param)
        },
      }),
    },
  },
  watch: isDevelopment,
  fingerprint: isDevelopment
    ? undefined
    : { buildId: process.env.GITHUB_SHA || String(Date.now()) },
})
