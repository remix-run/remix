import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { openLazyFile } from 'remix/fs'
import { createFileResponse } from 'remix/response/file'
import { createController } from 'remix/router'

import { routes } from '../routes.ts'
import { assets } from '../utils/assets.ts'

const defaultPagefindAssetsDir = path.resolve(
  import.meta.dirname,
  '../../build/site/assets/pagefind',
)

export function createRootController(pagefindAssetsDir = defaultPagefindAssetsDir) {
  return createController(routes, {
    actions: {
      async assets({ request, params }) {
        let pagefindResponse = await servePagefindAsset(request, params.path, pagefindAssetsDir)
        if (pagefindResponse) {
          return pagefindResponse
        }

        return (await assets.fetch(request)) ?? new Response('Not Found', { status: 404 })
      },
    },
  })
}

async function servePagefindAsset(
  request: Request,
  requestPath: string,
  pagefindAssetsDir: string,
): Promise<Response | undefined> {
  if (!requestPath.startsWith('pagefind/')) {
    return undefined
  }

  let assetPath = path.resolve(pagefindAssetsDir, requestPath.slice('pagefind/'.length))
  let relativeAssetPath = path.relative(pagefindAssetsDir, assetPath)
  if (relativeAssetPath.startsWith('..') || path.isAbsolute(relativeAssetPath)) {
    return new Response(null, { status: 204 })
  }

  try {
    let stats = await fs.stat(assetPath)
    if (stats.isFile()) {
      return await createFileResponse(openLazyFile(assetPath), request)
    }
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error
    }
  }

  return new Response(null, { status: 204 })
}

function isNotFoundError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error.code === 'ENOENT' || error.code === 'ENOTDIR')
  )
}
