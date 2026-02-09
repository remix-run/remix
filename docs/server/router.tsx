import * as path from 'node:path'
import { type RemixNode } from 'remix/component'
import { renderToString } from 'remix/component/server'
import { createRouter } from 'remix/fetch-router'
import { createHtmlResponse } from 'remix/response/html'
import { staticFiles } from 'remix/static-middleware'
import { Home, Layout, NotFound } from './components.tsx'
import { discoverMarkdownFiles, renderMarkdownFile } from './markdown.ts'
import { routes } from './routes.ts'

const REPO_DIR = path.resolve(process.cwd(), '..')
const MD_DIR = path.resolve(REPO_DIR, 'docs', 'api')
const PUBLIC_DIR = path.resolve(REPO_DIR, 'docs', 'public')

const { docFiles, docFilesLookup } = await discoverMarkdownFiles(MD_DIR)

export const router = createRouter({ middleware: [staticFiles(PUBLIC_DIR)] })

router.map(routes, {
  home: () => renderHtml(<Home />),
  async api({ url, params }) {
    let docFile = docFiles.find((file) => file.urlPath === params.path)
    return docFile
      ? await renderHtml(await renderMarkdownFile(docFile.path, docFilesLookup))
      : await renderHtml(<NotFound url={url} />, { status: 404 })
  },
})

async function renderHtml(node: RemixNode, init?: ResponseInit) {
  let html = await renderToString(<Layout docFiles={docFiles}>{node}</Layout>)
  return createHtmlResponse(html, init)
}
