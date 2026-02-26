import * as fs from 'node:fs'
import * as path from 'node:path'
import * as semver from 'semver'
import { Frame, type RemixNode } from 'remix/component'
import { renderToStream } from 'remix/component/server'
import { createRouter as _createRouter, type Router } from 'remix/fetch-router'
import { createHtmlResponse } from 'remix/response/html'
import { ServerPage, Home, NotFound, type ServerContext } from './components.tsx'
import { discoverMarkdownFiles, renderMarkdownFile } from './markdown.ts'
import { routes } from './routes.ts'
import { createFileResponse } from 'remix/response/file'
import { openLazyFile } from 'remix/fs'
import { ClientRouter } from '../client/client-router.tsx'

const DOCS_DIR = path.resolve(import.meta.dirname, '..', '..')
const REPO_DIR = path.resolve(DOCS_DIR, '..')
const BUILD_DIR = path.join(REPO_DIR, 'docs', 'build')
const MD_DIR = path.join(BUILD_DIR, 'md')
const ASSETS_DIR = path.join(BUILD_DIR, 'assets')
const DEV_CSS_DIR = path.join(DOCS_DIR, 'public')
const REMIX_PKG_JSON = path.join(REPO_DIR, 'packages', 'remix', 'package.json')

const { docFiles, docFilesLookup } = await discoverMarkdownFiles(MD_DIR)

export const getDefaultVersions = (): ServerContext['versions'] => {
  let version = JSON.parse(fs.readFileSync(REMIX_PKG_JSON, 'utf-8')).version
  return [{ version, crawl: semver.prerelease(version) === null }]
}

export function createRouter(versions?: ServerContext['versions']) {
  versions ??= getDefaultVersions()

  const router = _createRouter()

  const respond = {
    async file(request: Request, filePath: string, name: string) {
      return await createFileResponse(openLazyFile(filePath, { name }), request)
    },
    async document(request: Request, node: RemixNode, init?: ResponseInit) {
      let body = await stream(router, request, node, init)
      return createHtmlResponse(body, init)
    },
    async fragment(request: Request, node: RemixNode, init?: ResponseInit) {
      let body = await stream(router, request, node, init)
      return new Response(body, {
        ...init,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          ...init?.headers,
        },
      })
    },
  }
  router.map(routes, {
    assets: ({ request, params }) => {
      // Replicate `staticFiles` middleware but allowing for a dynamic version param
      let filePath =
        process.env.NODE_ENV === 'development' && params.asset.endsWith('.css')
          ? path.join(DEV_CSS_DIR, params.asset)
          : path.join(ASSETS_DIR, params.asset)
      return respond.file(request, filePath, params.asset)
    },
    async docs({ request, params }) {
      return await respond.document(
        request,
        <ServerPage
          setup={{
            docFiles,
            versions,
            slug: params.slug,
            activeVersion: params.version,
          }}
        >
          <Frame src={routes.fragment.href({ version: params.version, slug: params.slug })} />
        </ServerPage>,
      )
    },
    async home({ request, params }) {
      return respond.document(
        request,
        <ServerPage setup={{ docFiles, versions, activeVersion: params.version }}>
          <Frame src={routes.fragment.href({ version: params.version })} />
        </ServerPage>,
      )
    },
    async fragment({ request, url, params }) {
      let node: RemixNode

      if (!params.slug) {
        // Home page
        node = <Home />
      } else {
        // Docs page
        let docFile = docFiles.find((file) => file.urlPath === params.slug)
        if (!docFile) {
          node = <NotFound slug={params.slug} />
        } else {
          let html = await renderMarkdownFile(docFile.path, docFilesLookup, params.version)
          node = <div innerHTML={html} />
        }
      }

      return respond.fragment(
        request,
        <>
          {node}
          <ClientRouter />
        </>,
      )
    },
    async markdown({ request, params }) {
      let docFile = docFiles.find((file) => file.urlPath === params.slug)
      if (!docFile) {
        return new Response('Not Found', { status: 404 })
      }

      return respond.file(request, docFile.path, params.slug)
    },
  })

  return router
}

// Response helpers

function stream(router: Router, request: Request, node: RemixNode, init?: ResponseInit) {
  return renderToStream(node, {
    async resolveFrame(src) {
      let url = new URL(src, request.url)

      // IMPORTANT: this is a server-internal fetch to get *HTML*, so do not forward
      // Accept-Encoding — otherwise compression middleware could return compressed bytes.
      let headers = new Headers(request.headers)
      headers.delete('accept-encoding')
      headers.set('accept', 'text/html')

      let res = await router.fetch(
        new Request(url, {
          method: 'GET',
          headers,
          signal: request.signal,
        }),
      )

      if (!res.ok) {
        return `<pre>Frame error: ${res.status} ${res.statusText}</pre>`
      }

      if (res.body) {
        return res.body
      }

      return await res.text()
    },
  })
}
