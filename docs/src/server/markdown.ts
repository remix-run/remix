import * as frontmatter from 'front-matter'
import type { Element } from 'hast'
import { Marked, type MarkedExtension } from 'marked'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { codeToHtml } from 'shiki'
import { routes } from './routes.ts'
import { IGNORE_SYMBOLS, MDN_SYMBOLS } from '../generate/symbols.ts'

// No types exist for the `frontmatter` package
const parseFrontmatter = frontmatter.default as unknown as (md: string) => {
  attributes: Record<string, any>
  body: string
}

export type DocFile = {
  path: string
  type: string
  name: string
  package: string
  urlPath: string
}

export async function discoverMarkdownFiles(
  baseDir: string,
): Promise<{ docFiles: DocFile[]; docFilesLookup: Map<string, DocFile> }> {
  let files: DocFile[] = []
  walk(baseDir)
  let docFiles = files.sort((a, b) => a.urlPath.localeCompare(b.urlPath))
  const docFilesLookup = new Map<string, DocFile>()
  for (let file of docFiles) {
    docFilesLookup.set(file.name, file)
  }
  return { docFiles, docFilesLookup }

  function walk(dir: string) {
    let entries = fs.readdirSync(dir, { withFileTypes: true })

    for (let entry of entries) {
      let fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        walk(fullPath)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        let relativePath = path.relative(baseDir, fullPath)
        let parts = relativePath.split(path.sep)
        let packageName = parts.slice(0, parts.length - 2).join('/')
        let type = parts[parts.length - 2]
        let urlPath = relativePath.replace(/\.md$/, '').replace(/\\/g, '/')

        files.push({
          path: fullPath,
          type: type || 'unknown',
          name: entry.name.replace(/\.md$/, ''),
          package: packageName,
          urlPath: urlPath,
        })
      }
    }
  }
}

export async function renderMarkdownFile(
  filePath: string,
  docFilesLookup: Map<string, DocFile>,
  version?: string,
): Promise<string> {
  try {
    let markdown = fs.readFileSync(filePath, 'utf-8')
    let { attributes, body } = parseFrontmatter(markdown)
    let marked = new Marked(getShikiExtension(attributes.title || '', docFilesLookup, version))
    let htmlContent = await marked.parse(body)
    return htmlContent
  } catch (error) {
    return `
      <div class="error">
        <h2>Error loading file</h2>
        <p>Could not read file: ${filePath}</p>
      </div>
    `
  }
}

function getShikiExtension(
  apiName: string,
  docFilesLookup: Map<string, DocFile>,
  version?: string,
): MarkedExtension {
  return {
    async: true,
    async walkTokens(token) {
      if (token.type === 'code') {
        try {
          token.text = await codeToHtml(token.text, {
            lang: token.lang || 'typescript',
            themes: {
              light: 'github-light',
              // See Shiki styles in docs.css for activation
              dark: 'github-dark',
            },
            transformers: [
              // Insert cross-links to known APIs
              {
                span(node) {
                  // We only enhance single-symbol spans
                  if (node.children.length !== 1) return

                  let symbol = 'value' in node.children[0] ? node.children[0].value : ''
                  // Capture leading/trailing spaces for later
                  let leadingSpaces = symbol.length - symbol.trimStart().length
                  let trailingSpaces = symbol.length - symbol.trimEnd().length
                  symbol = symbol?.trim()

                  // Don't link to the current page
                  if (symbol === apiName) return
                  // Don't link to anything in the ignore list
                  if (IGNORE_SYMBOLS.has(symbol)) return

                  let linkEl: Element | undefined
                  if (docFilesLookup.has(symbol)) {
                    linkEl = link(symbol, {
                      href: routes.docs.href({
                        version,
                        slug: docFilesLookup.get(symbol)!.urlPath,
                      }),
                    })
                  } else if (MDN_SYMBOLS.hasOwnProperty(symbol)) {
                    linkEl = link(symbol, {
                      href: MDN_SYMBOLS[symbol as keyof typeof MDN_SYMBOLS],
                      target: '_blank',
                    })
                  }

                  if (linkEl) {
                    node.children = [
                      ...(leadingSpaces ? spacer(leadingSpaces) : []),
                      linkEl,
                      ...(trailingSpaces ? spacer(trailingSpaces) : []),
                    ]
                  }
                },
              },
            ],
          })
        } catch (error) {
          console.error(`Shiki highlighting failed for token: ${JSON.stringify(token)}`)
          console.error(error)
        }
      }
    },
    renderer: {
      code(code) {
        return code.text
      },
    },
  }

  // Spacer elements to preserve whitespace outside the inserted <a> elements
  function spacer(num: number) {
    return [
      {
        type: 'text',
        value: ' '.repeat(num),
      } as const,
    ]
  }

  function link(
    text: string,
    attrs: { href: HTMLAnchorElement['href']; target?: HTMLAnchorElement['target'] },
  ): Element {
    return {
      type: 'element',
      tagName: 'a',
      properties: attrs,
      children: [
        {
          type: 'text',
          value: text,
        },
      ],
    }
  }
}
