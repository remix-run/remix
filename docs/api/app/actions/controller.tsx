import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { createController } from 'remix/router'

import type { DocsContext, Versions } from '../data/docs.ts'
import { getVersionedLookupHref } from '../data/lookup.ts'
import { renderMarkdownFile } from '../data/markdown.ts'
import { getApiRouteHref, routes, withVersion } from '../routes.ts'
import { Document } from '../ui/document.tsx'
import type { DocsAssetServer } from '../assets.ts'
import { MarkdownContent } from './api/page.tsx'
import { fileResponse } from './file-response.ts'
import { VersionList } from './home.tsx'
import { LegacyRedirect } from './legacy-redirect.tsx'

const apiDir = path.resolve(import.meta.dirname, '..', '..')
const markdownDir = path.join(apiDir, 'build', 'md')
const gettingStartedPath = path.join(import.meta.dirname, 'getting-started.md')
const defaultPagefindAssetsDir = path.join(apiDir, 'build', 'site', '_assets', 'pagefind')

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
        let { html, headings } = await renderMarkdownFile(
          gettingStartedPath,
          docsContext.docFilesLookup,
          options.activeVersion,
          false,
        )
        return render(
          <Document
            registry={docsContext.getRegistry(options.activeVersion)}
            activeVersion={options.activeVersion}
            headings={headings}
          >
            <MarkdownContent html={html} />
            <VersionList versions={options.versions} activeVersion={options.activeVersion} />
          </Document>,
        )
      },
      async legacy({ request, params, render }) {
        let href = getApiRouteHref(`/api/${params.slug}`, options.activeVersion)
        // Paths that aren't docs (they come back unchanged) go to the home page.
        if (!href || href.startsWith(withVersion('/api/', options.activeVersion))) {
          href = withVersion(routes.home.href(), options.activeVersion)
        }
        // A static host can't redirect, so old Markdown URLs serve the file itself.
        if (href.endsWith('.md')) {
          let slug = href.slice(withVersion('/', options.activeVersion).length, -'.md'.length)
          let docsContext = await options.getDocsContext()
          let docFile = docsContext.docFiles.find((file) => file.urlPath === slug)
          return docFile && docFile.kind !== 'demo'
            ? fileResponse(request, docFile.path)
            : new Response('Not Found', { status: 404 })
        }
        return render(<LegacyRedirect href={href} />)
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
