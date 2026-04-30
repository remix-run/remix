import * as fs from 'node:fs'
import * as path from 'node:path'
import * as semver from 'semver'
import { type RemixNode } from 'remix/ui'
import { renderToStream } from 'remix/ui/server'
import { createRouter as _createRouter, type Router } from 'remix/fetch-router'
import { createHtmlResponse } from 'remix/response/html'
import { MarkdownContent, ServerPage, NotFound, type ServerContext } from './components.tsx'
import { discoverMarkdownFiles, renderMarkdownFile } from './markdown.ts'
import { routes } from './routes.ts'
import { createFileResponse } from 'remix/response/file'
import { openLazyFile } from 'remix/fs'

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

export function createRouter(versions: ServerContext['versions']) {
  const router = _createRouter()

  const respond = {
    async file(request: Request, filePath: string, name?: string) {
      name ??= path.basename(filePath)
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
    actions: {
      assets: ({ request, params }) => {
        // Replicate `staticFiles` middleware but allowing for a dynamic version param
        let devPath = path.join(DEV_CSS_DIR, params.asset)
        let filePath =
          process.env.NODE_ENV === 'development' && fs.existsSync(devPath)
            ? devPath
            : path.join(ASSETS_DIR, params.asset)
        return respond.file(request, filePath, params.asset)
      },
      async docs({ request, params }) {
        // Docs page
        let docFile = docFiles.find((file) => file.urlPath === params.slug)
        let node: RemixNode
        let sourceUrl: string | undefined

        if (!docFile) {
          node = <NotFound slug={params.slug} />
        } else {
          let { html, source } = await renderMarkdownFile(
            docFile.path,
            docFilesLookup,
            params.version,
          )
          node = <MarkdownContent html={html} />
          sourceUrl = source
        }

        return await respond.document(
          request,
          <ServerPage
            docFiles={docFiles}
            versions={versions}
            slug={params.slug}
            activeVersion={params.version}
            sourceUrl={sourceUrl}
          >
            {node}
          </ServerPage>,
        )
      },
      async home({ request, params }) {
        return respond.document(
          request,
          <ServerPage docFiles={docFiles} versions={versions} activeVersion={params.version}>
            <h1>Welcome to Remix 3!</h1>
            <p>
              Remix is a batteries-included, ultra-productive, zero dependencies and bundler-free
              framework, ready to develop with in a model-first world.
            </p>
            <p>
              Remix 3 is a reimagining of what a web framework can be; a fresh foundation shaped by
              decades of experience building for the web. Our focus is on simplicity, clarity, and
              performance, without giving up the power developers need.
            </p>
            <p>When working on Remix 3, we follow these principles:</p>

            <ol>
              <li>
                <b>Model-First Development.</b> AI fundamentally shifts the human-computer
                interaction model for both user experience and developer workflows. Optimize the
                source code, documentation, tooling, and abstractions for LLMs. Additionally,
                develop abstractions for applications to use models in the product itself, not just
                as a tool to develop it.
              </li>
              <li>
                <b>Build on Web APIs.</b> Sharing abstractions across the stack greatly reduces the
                amount of context switching, both for humans and machines. Build on the foundation
                of Web APIs and JavaScript because it is the only full stack ecosystem.
              </li>
              <li>
                <b>Religiously Runtime.</b> Designing for bundlers/compilers/typegen (and any
                pre-runtime static analysis) leads to poor API design that eventually pollutes the
                entire system. All packages must be designed with no expectation of static analysis
                and all tests must run without bundling. Because browsers are involved, --import
                loaders for simple transformations like TypeScript and JSX are permissible.
              </li>
              <li>
                <b>Avoid Dependencies.</b> Dependencies lock you into somebody else's roadmap.
                Choose them wisely, wrap them completely, and expect to replace most of them with
                our own package eventually. The goal is zero.
              </li>
              <li>
                <b>Demand Composition.</b> Abstractions should be single-purpose and replaceable. A
                composable abstraction is easy to add and remove from an existing program. Every
                package must be useful and documented independent of any other context. New features
                should first be attempted as a new package. If impossible, attempt to break up the
                existing package to make it more composable. However, tightly coupled modules that
                almost always change together in both directions should be moved to the same
                package.
              </li>
              <li>
                <b>Distribute Cohesively.</b> Extremely composable ecosystems are difficult to learn
                and use. Remix will be distributed as a single remix package for both distribution
                and documentation.
              </li>
            </ol>
          </ServerPage>,
        )
      },
      async lookup({ request, params }) {
        let jsonPath = path.join(MD_DIR, 'api.json')
        if (!params.version) {
          return respond.file(request, jsonPath)
        }
        let content = JSON.parse(await fs.promises.readFile(jsonPath, 'utf-8'))
        for (let key in content) {
          content[key] = `/${params.version}${content[key]}`
        }
        return Response.json(content)
      },
      async markdown({ request, params }) {
        let docFile = docFiles.find((file) => file.urlPath === params.slug)
        if (!docFile) {
          return new Response('Not Found', { status: 404 })
        }

        return respond.file(request, docFile.path)
      },
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
