import * as frontmatter from 'front-matter'
import type { Element } from 'hast'
import { Marked, type MarkedExtension } from 'marked'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { codeToHtml } from 'shiki'
import { IGNORE_SYMBOLS, MDN_SYMBOLS } from '../generate/symbols.ts'
import { routes } from './routes.ts'

// No types exist for the `frontmatter` package
const parseFrontmatter = frontmatter.default as unknown as (md: string) => {
  attributes: Record<string, any>
  body: string
}

const apiTypeKinds = ['type', 'interface', 'class', 'function', 'mixin', 'variable'] as const
export type ApiTypeKind = (typeof apiTypeKinds)[number]

export type ApiDocFile = {
  kind: 'api'
  path: string
  type: ApiTypeKind
  name: string
  package: string
  urlPath: string
}

export type PackageDocFile = {
  kind: 'package'
  path: string
  type: 'package'
  name: string
  package: string
  urlPath: string
}

export type DocFile = ApiDocFile | PackageDocFile

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
        files.push(getDocFile(baseDir, fullPath))
      }
    }
  }
}

function getDocFile(baseDir: string, fullPath: string): DocFile {
  let relativePath = path.relative(baseDir, fullPath)
  let parts = relativePath.split(path.sep)
  let name = path.basename(fullPath, '.md')

  let markdown = fs.readFileSync(fullPath, 'utf-8')
  let { attributes } = parseFrontmatter(markdown)

  if (attributes.type === 'package') {
    let packageName = parts.slice(0, -1).join('/')
    return {
      kind: 'package',
      path: fullPath,
      type: 'package',
      name: packageName,
      package: packageName,
      urlPath: relativePath.replace(/\.md$/, '').replace(/\\/g, '/'),
    }
  }

  let packageName = parts.slice(0, -2).join('/')
  return {
    kind: 'api',
    path: fullPath,
    type: getApiTypeKind(parts.at(-2)),
    name,
    package: packageName,
    urlPath: relativePath.replace(/\.md$/, '').replace(/\\/g, '/'),
  }
}

function getApiTypeKind(value: string | undefined): ApiTypeKind {
  if (apiTypeKinds.includes(value as ApiTypeKind)) {
    return value as ApiTypeKind
  }
  throw new Error(`Invalid API docs type: ${value ?? '<missing>'}`)
}

export async function renderMarkdownFile(
  filePath: string,
  docFilesLookup: Map<string, DocFile>,
  version: string | undefined,
  addLinks: boolean,
): Promise<{ html: string; source?: string }> {
  try {
    let markdown = fs.readFileSync(filePath, 'utf-8')
    let { attributes, body } = parseFrontmatter(markdown)
    let marked = new Marked(
      getShikiExtension(attributes.title || '', docFilesLookup, version, addLinks),
    )
    let html = await marked.parse(body)
    return { html, source: typeof attributes.source === 'string' ? attributes.source : undefined }
  } catch (error) {
    return {
      html: `
      <div class="error">
        <h2>Error loading file</h2>
        <p>Could not read file: ${filePath}</p>
      </div>
    `,
    }
  }
}

function getShikiExtension(
  apiName: string,
  docFilesLookup: Map<string, DocFile>,
  version: string | undefined,
  addLinks: boolean,
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
              // See Shiki styles for activation
              dark: 'github-dark',
            },
            includeExplanation: true,
            transformers: [
              // Insert cross-links to known APIs
              {
                span(node, line, col) {
                  if (!addLinks) {
                    return
                  }

                  // We only enhance single-symbol spans of word characters,
                  // skipping spans for parens, braces, etc
                  if (
                    node.children.length !== 1 ||
                    !('value' in node.children[0]) ||
                    !/^[\w ]+$/i.test(node.children[0].value)
                  ) {
                    return
                  }

                  let symbol = node.children[0].value

                  // Capture leading/trailing spaces for later
                  let leadingSpaces = symbol.length - symbol.trimStart().length
                  let trailingSpaces = symbol.length - symbol.trimEnd().length
                  symbol = symbol?.trim()

                  // Don't link to the current page
                  if (symbol === apiName) return
                  // Don't link to anything in the ignore list
                  if (IGNORE_SYMBOLS.has(symbol)) return

                  // We don't want to auto link parameter names, function names, etc.
                  // The things we do want to link (mostly type annotations) don't seem
                  // to have an explanation so we use that to decide when to link
                  if (this.tokens[line]?.[col]?.explanation != null) return

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
      link(token) {
        let href = getDocsRouteHref(token.href, version)
        if (!href) return false

        let title = token.title ? ` title="${escapeHtml(token.title)}"` : ''
        return `<a href="${escapeHtml(href)}"${title}>${this.parser.parseInline(token.tokens)}</a>`
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

function getDocsRouteHref(href: string, version: string | undefined): string | undefined {
  if (!href.startsWith('/api/')) return undefined

  let url = new URL(href, 'http://localhost')
  let slug = url.pathname.slice('/api/'.length)
  if (slug.length === 0) return undefined

  let routeHref: string
  if (slug.endsWith('.md')) {
    routeHref = routes.markdown.href({ version, slug: slug.slice(0, -'.md'.length) })
  } else {
    routeHref = routes.docs.href({ version, slug: slug.replace(/\/$/, '') })
  }

  return `${routeHref}${url.search}${url.hash}`
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return char
    }
  })
}
