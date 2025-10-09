import * as fs from 'node:fs'
import * as path from 'node:path'
import * as zlib from 'node:zlib'
import { Readable } from 'node:stream'
import type { InferRouteHandler } from '@remix-run/fetch-router'

import { routes } from '../routes.ts'

const publicAssetsDir = path.join(import.meta.dirname, '..', 'public', 'assets')

export let assetsHandler: InferRouteHandler<typeof routes.assets> = async ({ params }) => {
  return serveJavaScript(path.join(publicAssetsDir, params.path))
}

export function serveJavaScript(file: string): Response {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    return new Response('Not found', { status: 404 })
  }

  let fileStream = fs.createReadStream(file)
  let gzipStream = fileStream.pipe(zlib.createGzip())

  return new Response(Readable.toWeb(gzipStream) as unknown as ReadableStream, {
    headers: {
      'Cache-Control': 'no-store, must-revalidate',
      'Content-Type': 'application/javascript',
      'Content-Encoding': 'gzip',
      Vary: 'Accept-Encoding',
    },
  })
}
