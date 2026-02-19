import * as fs from 'node:fs'
import * as path from 'node:path'
import { Frame, type RemixNode } from 'remix/component'
import { renderToStream } from 'remix/component/server'
import { createRouter as _createRouter, type Router } from 'remix/fetch-router'
import { createHtmlResponse } from 'remix/response/html'
import {
  ServerProvider,
  Home,
  Layout,
  NotFound,
  Document,
  type ServerContext,
} from './components.tsx'
import { discoverMarkdownFiles, renderMarkdownFile } from './markdown.ts'
import { routes } from './routes.ts'
import { createFileResponse } from 'remix/response/file'
import { openLazyFile } from 'remix/fs'
import { ClientRouter } from '../client/client-router.tsx'

const DOCS_DIR = process.cwd()
const REPO_DIR = path.resolve(DOCS_DIR, '..')
const BUILD_DIR = path.join(REPO_DIR, 'docs', 'build')
const MD_DIR = path.join(BUILD_DIR, 'md')
const ASSETS_DIR = path.join(BUILD_DIR, 'assets')
const DEV_CSS_DIR = path.join(DOCS_DIR, 'public')
const REMIX_PKG = path.join(REPO_DIR, 'packages', 'remix')

const { docFiles, docFilesLookup } = await discoverMarkdownFiles(MD_DIR)

export function createRouter(versions?: ServerContext['versions']) {
  versions ??= getDefaultVersions()

  const router = _createRouter()

  router.map(routes, {
    assets: ({ request, params }) => {
      // Replicate `staticFiles` middleware but allowing for a dynamic version param
      let filePath =
        process.env.NODE_ENV === 'development' && params.asset.endsWith('.css')
          ? path.join(DEV_CSS_DIR, params.asset)
          : path.join(ASSETS_DIR, params.asset)
      let lazyFile = openLazyFile(filePath, { name: params.asset })
      return createFileResponse(lazyFile, request)
    },
    async docs({ request, params }) {
      return await document(
        router,
        request,
        <ServerProvider
          setup={{
            docFiles,
            versions,
            slug: params.slug,
            activeVersion: params.version,
          }}
        >
          <Document>
            <Layout>
              <Frame src={routes.fragment.href({ version: params.version, slug: params.slug })} />
            </Layout>
          </Document>
        </ServerProvider>,
      )
    },
    async home({ request, params }) {
      return document(
        router,
        request,
        <ServerProvider setup={{ docFiles, versions, activeVersion: params.version }}>
          <Document>
            <Layout>
              <Frame src={routes.fragment.href({ version: params.version })} />
            </Layout>
          </Document>
        </ServerProvider>,
      )
    },
    async fragment({ request, url, params }) {
      if (!params.slug) {
        return fragment(
          router,
          request,
          <>
            <Home />
            <ClientRouter />
          </>,
        )
      }

      let docFile = docFiles.find((file) => file.urlPath === params.slug)
      if (!docFile) {
        return await fragment(router, request, <NotFound url={url} />, { status: 404 })
      }

      let html = await renderMarkdownFile(docFile.path, docFilesLookup, params.version)
      return await fragment(
        router,
        request,
        <>
          <div innerHTML={html} />
          <ClientRouter />
        </>,
      )
    },
    async md({ request, url, params }) {
      if (!params.slug) {
        return new Response('Not Found', { status: 404 })
      }

      let docFile = docFiles.find((file) => file.urlPath === params.slug)
      if (!docFile) {
        return new Response('Not Found', { status: 404 })
      }

      // Replicate `staticFiles` middleware but allowing for a dynamic version param
      let lazyFile = openLazyFile(docFile.path, { name: params.slug })
      return createFileResponse(lazyFile, request)
    },
  })

  return router
}

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

async function fragment(router: Router, request: Request, node: RemixNode, init?: ResponseInit) {
  let body = await stream(router, request, node, init)
  return new Response(body, {
    ...init,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...init?.headers,
    },
  })
}

async function document(router: Router, request: Request, node: RemixNode, init?: ResponseInit) {
  let body = await stream(router, request, node, init)
  return createHtmlResponse(body, init)
}

export function getDefaultVersions(): ServerContext['versions'] {
  let remixPkgJson = path.join(REMIX_PKG, 'package.json')
  let { version } = JSON.parse(fs.readFileSync(remixPkgJson, 'utf-8'))
  return [{ version, crawl: true }]
}
