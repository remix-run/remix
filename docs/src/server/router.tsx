import * as path from 'node:path'
import { type RemixNode } from 'remix/component'
import { renderToString } from 'remix/component/server'
import { createRouter } from 'remix/fetch-router'
import { createHtmlResponse } from 'remix/response/html'
import { staticFiles } from 'remix/static-middleware'
import { App, Home, NotFound, type AppContext } from './components.tsx'
import { discoverMarkdownFiles, renderMarkdownFile } from './markdown.ts'
import { routes } from './routes.ts'
import { createFileResponse } from 'remix/response/file'
import { openLazyFile } from 'remix/fs'

const REPO_DIR = path.resolve(process.cwd(), '..')
const MD_DIR = path.resolve(REPO_DIR, 'docs', 'build', 'md')
const PUBLIC_DIR = path.resolve(REPO_DIR, 'docs', 'public')

const versions: AppContext['versions'] = [{ name: 'latest', crawl: true }]

// Normally, we'll only prerender new HTML docs for the latest version
// VERSION=v3.1.0 pnpm run prerender
if (process.env.VERSION) {
  versions.push({ name: process.env.VERSION, version: process.env.VERSION, crawl: true })
}

// Then we also need to include links in the nav for prior versions
// This will eventually be auto-generated based on the existing pre-rendered
// HTML folders on disk
let oldVersions: AppContext['versions'] = [
  { name: 'v3.0.2', version: 'v3.0.2', crawl: false },
  { name: 'v3.0.1', version: 'v3.0.1', crawl: false },
  { name: 'v3.0.0', version: 'v3.0.0', crawl: false },
]

versions.push(...oldVersions)

const { docFiles, docFilesLookup } = await discoverMarkdownFiles(MD_DIR)

export const router = createRouter()

router.map(routes, {
  home: ({ params }) =>
    renderHtml(
      <App setup={{ docFiles, versions, version: params.version }}>
        <Home />
      </App>,
    ),
  async api({ url, params }) {
    let appContext: AppContext = {
      docFiles,
      versions,
      slug: params.slug,
      version: params.version,
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

async function renderHtml(node: RemixNode, init?: ResponseInit) {
  return createHtmlResponse(await renderToString(node), init)
}
