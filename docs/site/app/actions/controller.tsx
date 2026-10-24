import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { createController } from 'remix/router'

import type { DocsContext } from '../data/docs.ts'
import { renderMarkdownFile } from '../data/markdown.ts'
import { routes } from '../routes.ts'
import { ReferenceDocument } from '../ui/document.tsx'
import type { DocsAssetServer } from '../assets.ts'
import { MarkdownContent } from './reference/page.tsx'
import { fileResponse } from './file-response.ts'

const siteDir = path.resolve(import.meta.dirname, '..', '..')
const markdownDir = path.join(siteDir, 'build', 'md')
const gettingStartedPath = path.join(import.meta.dirname, 'getting-started.md')
const defaultPagefindAssetsDir = path.join(siteDir, 'build', 'site', '_assets', 'pagefind')

interface RootControllerOptions {
  assetServer: DocsAssetServer
  getDocsContext(): Promise<DocsContext>
  pagefindAssetsDir?: string
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
        let { html, headings } = await renderMarkdownFile(
          gettingStartedPath,
          docsContext.docFilesLookup,
          false,
        )
        return render(
          <ReferenceDocument registry={docsContext.registry} headings={headings}>
            <MarkdownContent html={html} />
          </ReferenceDocument>,
        )
      },
      lookup({ request }) {
        return fileResponse(request, path.join(markdownDir, 'api.json'))
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
