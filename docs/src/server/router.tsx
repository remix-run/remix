import * as fs from 'node:fs'
import * as path from 'node:path'
import { openLazyFile } from 'remix/fs'
import { staticFiles } from 'remix/middleware/static'
import { createFileResponse } from 'remix/response/file'
import { createHtmlResponse } from 'remix/response/html'
import { createRouter as _createRouter, type Router } from 'remix/router'
import { clientEntry, type RemixNode } from 'remix/ui'
import { renderToStream } from 'remix/ui/server'
import { assetServer, entryPreloads } from './asset-server.ts'
import { discoverDemoFiles, loadDemoComponent, renderDemoSource } from './demos.tsx'
import { discoverMarkdownFiles, renderMarkdownFile } from './markdown.ts'
import { buildRegistry, type DocsRegistry } from './registry.ts'
import { routes } from './routes.ts'
import { DemoContent, Document, Home, MarkdownContent, NotFound, type Versions } from './view.tsx'

const DOCS_DIR = path.resolve(import.meta.dirname, '..', '..')
const REPO_DIR = path.resolve(DOCS_DIR, '..')
const BUILD_DIR = path.join(REPO_DIR, 'docs', 'build')
const MD_DIR = path.join(BUILD_DIR, 'md')
const PUBLIC_DIR = path.join(BUILD_DIR, 'public')
const REMIX_PKG_JSON = path.join(REPO_DIR, 'packages', 'remix', 'package.json')

const { docFiles: markdownFiles, docFilesLookup } = await discoverMarkdownFiles(MD_DIR)
const demoFiles = await discoverDemoFiles()
const docFiles = [...markdownFiles, ...demoFiles].sort((a, b) => a.urlPath.localeCompare(b.urlPath))

const registryByVersion = new Map<string | undefined, DocsRegistry>()
registryByVersion.set(undefined, buildRegistry(docFiles))

function getRegistry(version?: string): DocsRegistry {
  let registry = registryByVersion.get(version)
  if (!registry) {
    registry = buildRegistry(docFiles, version)
    registryByVersion.set(version, registry)
  }
  return registry
}

export const getDefaultVersions = (): Versions => {
  let version = JSON.parse(fs.readFileSync(REMIX_PKG_JSON, 'utf-8')).version
  return [version]
}

export function createRouter(versions: Versions) {
  const router = _createRouter({ middleware: [staticFiles(PUBLIC_DIR)] })

  const respond = {
    async file(request: Request, filePath: string, name?: string) {
      name ??= path.basename(filePath)
      return await createFileResponse(openLazyFile(filePath, { name }), request)
    },
    async document(request: Request, node: RemixNode, init?: ResponseInit) {
      let body = await stream(router, request, node, init)
      return createHtmlResponse(body, init)
    },
  }

  router.map(routes, {
    actions: {
      assets: async ({ request, params }) => {
        // Drop the optional version prefix so the asset server sees a stable URL space.
        let url = new URL(request.url)
        url.pathname = routes.assets.href({ asset: params.asset })
        let response = await assetServer.fetch(new Request(url, request))
        return response ?? new Response('Not Found', { status: 404 })
      },
      async docs({ request, params }) {
        let docFile = docFiles.find((file) => file.urlPath === params.slug)
        let docProps = {
          registry: getRegistry(params.version),
          versions: versions,
          slug: params.slug,
          activeVersion: params.version,
          entryPreloads,
        }

        if (docFile) {
          if (docFile.kind === 'demo') {
            let ExampleComponent = clientEntry(
              `${docFile.assetHref}#default`,
              await loadDemoComponent(docFile),
            )
            let sourceHtml = await renderDemoSource(docFile.source)
            return await respond.document(
              request,
              <Document {...docProps} sourceUrl={docFile.sourceUrl}>
                <DemoContent demo={docFile} sourceHtml={sourceHtml}>
                  <ExampleComponent key={docFile.slug} />
                </DemoContent>
              </Document>,
            )
          }

          let { html, source } = await renderMarkdownFile(
            docFile.path,
            docFilesLookup,
            params.version,
            // Don't auto-link code symbols in README - too many false positives.
            docFile.kind !== 'package',
          )
          return await respond.document(
            request,
            <Document {...docProps} sourceUrl={source}>
              <MarkdownContent html={html} />
            </Document>,
          )
        }

        return await respond.document(
          request,
          <Document {...docProps}>
            <NotFound slug={params.slug} />
          </Document>,
          { status: 404 },
        )
      },
      async home({ request, params }) {
        return respond.document(
          request,
          <Document
            registry={getRegistry(params.version)}
            versions={versions}
            activeVersion={params.version}
            entryPreloads={entryPreloads}
          >
            <Home />
          </Document>,
        )
      },
      async lookup({ request, params }) {
        let jsonPath = path.join(MD_DIR, 'api.json')
        if (!params.version) {
          return respond.file(request, jsonPath)
        }

        let content = JSON.parse(await fs.promises.readFile(jsonPath, 'utf-8'))
        for (let key in content) {
          content[key] = getLookupHref(content[key], params.version)
        }
        return Response.json(content)
      },
      async markdown({ request, params }) {
        let docFile = docFiles.find((file) => file.urlPath === params.slug)
        if (!docFile) {
          return new Response('Not Found', { status: 404 })
        }

        if (docFile.kind === 'demo') {
          let md = `# ${docFile.name}\n\n${docFile.description}\n\n\`\`\`tsx\n${docFile.source}\n\`\`\`\n`
          return new Response(md, {
            headers: { 'content-type': 'text/markdown; charset=utf-8' },
          })
        }

        return respond.file(request, docFile.path)
      },
    },
  })

  return router
}

// Response helpers

function getLookupHref(href: string, version: string): string {
  if (!href.startsWith('/api/')) return href

  return routes.docs.href({
    version,
    slug: href.slice('/api/'.length).replace(/\/$/, ''),
  })
}

function stream(router: Router, request: Request, node: RemixNode, init?: ResponseInit) {
  return renderToStream(node, {
    signal: request.signal,
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
