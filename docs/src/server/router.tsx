import * as fs from 'node:fs'
import * as path from 'node:path'
import { type RemixNode } from 'remix/component'
import { renderToString } from 'remix/component/server'
import { createRouter as _createRouter } from 'remix/fetch-router'
import { createHtmlResponse } from 'remix/response/html'
import { App, Home, NotFound, type AppContext } from './components.tsx'
import { discoverMarkdownFiles, renderMarkdownFile } from './markdown.ts'
import { routes } from './routes.ts'
import { createFileResponse } from 'remix/response/file'
import { openLazyFile } from 'remix/fs'

const REPO_DIR = path.resolve(process.cwd(), '..')
const MD_DIR = path.resolve(REPO_DIR, 'docs', 'build', 'md')
const PUBLIC_DIR = path.resolve(REPO_DIR, 'docs', 'public')
const REMIX_PKG = path.join(REPO_DIR, 'packages', 'remix')

const { docFiles, docFilesLookup } = await discoverMarkdownFiles(MD_DIR)

export function createRouter(versions?: AppContext['versions']) {
  versions ??= getDefaultVersions()

  const router = _createRouter()

  router.map(routes, {
    home: ({ params }) =>
      renderHtml(
        <App setup={{ docFiles, versions, activeVersion: params.version }}>
          <Home />
        </App>,
      ),
    async api({ url, params }) {
      let appContext: AppContext = {
        docFiles,
        versions,
        slug: params.slug,
        activeVersion: params.version,
      }

      let docFile = docFiles.find((file) => file.urlPath === params.slug)

      if (!docFile) {
        return await renderHtml(
          <App setup={appContext}>
            <NotFound url={url} />
          </App>,
          { status: 404 },
        )
      }

      return await renderHtml(
        <App setup={appContext}>
          {await renderMarkdownFile(docFile.path, docFilesLookup, params.version)}
        </App>,
      )
    },
    assets: ({ request, params }) => {
      // Replicate `staticFiles` middleware but allowing for a dynamic version param
      let filePath = path.join(PUBLIC_DIR, params.asset)
      let lazyFile = openLazyFile(filePath, { name: path.basename(PUBLIC_DIR, filePath) })
      return createFileResponse(lazyFile, request)
    },
  })

  return router
}

async function renderHtml(node: RemixNode, init?: ResponseInit) {
  return createHtmlResponse(await renderToString(node), init)
}

function getDefaultVersions(): AppContext['versions'] {
  let remixPkgJson = path.join(REMIX_PKG, 'package.json')
  let { version } = JSON.parse(fs.readFileSync(remixPkgJson, 'utf-8'))
  return [{ version, crawl: true }]
}
