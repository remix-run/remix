import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { createController } from 'remix/router'

import type { DocsContext, Versions } from '../data/docs.ts'
import { getVersionedLookupHref } from '../data/lookup.ts'
import { routes } from '../routes.ts'
import { Document } from '../ui/document.tsx'
import type { DocsAssetServer } from '../utils/assets.ts'
import { fileResponse } from './file-response.ts'
import { Home } from './home.tsx'

const apiDir = path.resolve(import.meta.dirname, '..', '..')
const markdownDir = path.join(apiDir, 'build', 'md')
const defaultPagefindAssetsDir = path.join(apiDir, 'build', 'site', 'assets', 'pagefind')

interface RootControllerOptions {
  activeVersion?: string
  assetServer: DocsAssetServer
  getDocsContext(): Promise<DocsContext>
  pagefindAssetsDir?: string
  versions: Versions
}

export function createRootController(options: RootControllerOptions) {
  let pagefindAssetsDir = options.pagefindAssetsDir ?? defaultPagefindAssetsDir

  return createController(routes, {
    actions: {
      async assets({ request, params }) {
        if (params.asset.startsWith('pagefind/')) {
          return servePagefindAsset(request, params.asset, pagefindAssetsDir)
        }

        return (
          (await options.assetServer.fetch(request)) ?? new Response('Not Found', { status: 404 })
        )
      },
      async home({ render }) {
        let docsContext = await options.getDocsContext()
        return render(
          <Document
            registry={docsContext.getRegistry(options.activeVersion)}
            versions={options.versions}
            activeVersion={options.activeVersion}
          >
            <Home />
          </Document>,
        )
      },
      async lookup({ request }) {
        let jsonPath = path.join(markdownDir, 'api.json')
        if (!options.activeVersion) {
          return fileResponse(request, jsonPath)
        }

        let content: Record<string, string> = JSON.parse(await fs.readFile(jsonPath, 'utf-8'))
        for (let key in content) {
          content[key] = getVersionedLookupHref(content[key], options.activeVersion)
        }
        return Response.json(content)
      },
    },
  })
}

async function servePagefindAsset(
  request: Request,
  requestPath: string,
  pagefindAssetsDir: string,
): Promise<Response> {
  let assetPath = path.resolve(pagefindAssetsDir, requestPath.slice('pagefind/'.length))
  let relativeAssetPath = path.relative(pagefindAssetsDir, assetPath)
  if (relativeAssetPath.startsWith('..') || path.isAbsolute(relativeAssetPath)) {
    return new Response(null, { status: 204 })
  }

  try {
    let stats = await fs.stat(assetPath)
    if (stats.isFile()) {
      return fileResponse(request, assetPath)
    }
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error
    }
  }

  console.warn(`[WARN] Pagefind asset not found: ${new URL(request.url).pathname}`)
  return new Response(null, { status: 204 })
}

function isNotFoundError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error.code === 'ENOENT' || error.code === 'ENOTDIR')
  )
}
