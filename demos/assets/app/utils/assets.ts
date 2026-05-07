import * as path from 'node:path'
import { createAssetServer, defineFileTransform } from 'remix/assets'
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
  fingerprint: isDevelopment
    ? undefined
    : { buildId: process.env.GITHUB_SHA || String(Date.now()) },
})
