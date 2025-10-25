import * as path from 'node:path'
import type { BuildRouteHandler } from '@remix-run/fetch-router'
import { openFile } from '@remix-run/lazy-file/fs'

import { routes } from '../routes.ts'

const publicDir = path.join(import.meta.dirname, '..', 'public')
const publicAssetsDir = path.join(publicDir, 'assets')
const publicImagesDir = path.join(publicDir, 'images')

export let assets: BuildRouteHandler<'GET', typeof routes.assets> = async ({ params }) => {
  return serveFile(path.join(publicAssetsDir, params.path))
}

export let images: BuildRouteHandler<'GET', typeof routes.images> = async ({ params }) => {
  return serveFile(path.join(publicImagesDir, params.path))
}

function serveFile(filename: string): Response {
  try {
    let file = openFile(filename)

    return new Response(file, {
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
        'Content-Type': file.type,
      },
    })
  } catch (error) {
    if (isNoEntityError(error)) {
      return new Response('Not found', { status: 404 })
    }

    throw error
  }
}

function isNoEntityError(error: unknown): error is NodeJS.ErrnoException & { code: 'ENOENT' } {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}
