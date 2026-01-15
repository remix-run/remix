import { html, SafeHtml } from '@remix-run/html-template'
import { marked } from 'marked'
import * as fs from 'node:fs'
import * as path from 'node:path'

export const DOCS_DIR = path.resolve(process.cwd(), 'docs/api')

export type DocFile = {
  path: string
  type: string
  name: string
  package: string
  urlPath: string
}

export async function discoverMarkdownFiles(dir: string): Promise<DocFile[]> {
  let files: DocFile[] = []

  let packagesDir = path.resolve(process.cwd(), 'packages')
  let packageJsons = fs
    .readdirSync(packagesDir, { withFileTypes: true })
    .map((d) => path.join(packagesDir, d.name, 'package.json'))
  let pkgMap: Record<string, string> = {}
  await Promise.all(
    packageJsons.map(async (pkgPath) => {
      let { name } = JSON.parse(await fs.promises.readFile(pkgPath, 'utf-8'))
      let urlName = name.replace(/^@remix-run\//, '').replace(/\//g, '-')
      pkgMap[urlName] = name
    }),
  )

  function walk(dir: string) {
    let entries = fs.readdirSync(dir, { withFileTypes: true })

    for (let entry of entries) {
      let fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        walk(fullPath)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        let relativePath = path.relative(dir, fullPath)
        let parts = relativePath.split(path.sep)
        let packageName = parts.slice(0, parts.length - 1).join('/')
        let urlPath = '/docs/' + relativePath.replace(/\.md$/, '').replace(/\\/g, '/')

        let markdown = fs.readFileSync(fullPath, 'utf-8')
        // @ts-expect-error No types
        let { attributes } = frontmatter.default(markdown)

        files.push({
          path: fullPath,
          type: attributes.type || 'unknown',
          name: entry.name.replace(/\.md$/, ''),
          package: packageName,
          urlPath: urlPath,
        })
      }
    }
  }

  walk(dir)
  return files.sort((a, b) => a.urlPath.localeCompare(b.urlPath))
}

export async function renderMarkdownFile(filePath: string): Promise<SafeHtml> {
  try {
    let markdown = fs.readFileSync(filePath, 'utf-8')

    // Remove frontmatter if present
    markdown = markdown.replace(/^---\n[\s\S]*?\n---\n/, '')

    let htmlContent = await marked.parse(markdown)
    return html.raw`${htmlContent}`
  } catch (error) {
    return html`
      <div class="error">
        <h2>Error loading file</h2>
        <p>Could not read file: ${filePath}</p>
      </div>
    `
  }
}
