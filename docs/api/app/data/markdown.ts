import * as fs from 'node:fs'
import * as path from 'node:path'

import type { Element } from 'hast'
import type { ShikiTransformer } from 'shiki'
import { addHeadingIds, readMarkdownHeadingsFromRoot } from 'remix-docs-shared/markdown/headings'
import { parseMarkdownDocument, parseMarkdownFrontmatter } from 'remix-docs-shared/markdown/parser'
import { renderMarkdownHtml } from 'remix-docs-shared/markdown/render'
import type { MarkdownHeading } from 'remix-docs-shared/markdown/types'

import { getApiRouteHref, routes, withVersion } from '../routes.ts'
import { IGNORE_SYMBOLS, MDN_SYMBOLS } from '../utils/symbols.ts'

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
  let { attributes } = parseMarkdownFrontmatter(markdown)

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
  if (
    value === 'type' ||
    value === 'interface' ||
    value === 'class' ||
    value === 'function' ||
    value === 'mixin' ||
    value === 'variable'
  ) {
    return value
  }
  throw new Error(`Invalid API docs type: ${value ?? '<missing>'}`)
}

export async function renderMarkdownFile(
  filePath: string,
  docFilesLookup: Map<string, DocFile>,
  version: string | undefined,
  addCodeLinks: boolean,
): Promise<{
  html: string
  headings: MarkdownHeading[]
  source?: string
}> {
  try {
    let markdown = fs.readFileSync(filePath, 'utf-8')
    let { attributes, root } = parseMarkdownDocument(markdown)
    let title = typeof attributes.title === 'string' ? attributes.title : ''
    let transformers = addCodeLinks
      ? [createApiCodeLinkTransformer(title, docFilesLookup, version)]
      : []

    addHeadingIds(root)

    return {
      html: await renderMarkdownHtml(root, {
        highlightCode: {
          includeExplanation: addCodeLinks,
          transformers,
        },
        transformLink(href) {
          return getApiRouteHref(href, version)
        },
      }),
      headings: readMarkdownHeadingsFromRoot(root),
      source: typeof attributes.source === 'string' ? attributes.source : undefined,
    }
  } catch {
    return {
      html: `
      <div class="error">
        <h2>Error loading file</h2>
        <p>Could not read file: ${filePath}</p>
      </div>
    `,
      headings: [],
    }
  }
}

function createApiCodeLinkTransformer(
  apiName: string,
  docFilesLookup: Map<string, DocFile>,
  version: string | undefined,
): ShikiTransformer {
  return {
    name: 'remix-api-code-links',
    span(node, line, column) {
      // Only enhance single-symbol spans of word characters, skipping spans for
      // punctuation, braces, and other syntax.
      if (
        node.children.length !== 1 ||
        !('value' in node.children[0]) ||
        !/^[\w ]+$/i.test(node.children[0].value)
      ) {
        return
      }

      let symbol = node.children[0].value
      let leadingSpaces = symbol.length - symbol.trimStart().length
      let trailingSpaces = symbol.length - symbol.trimEnd().length
      symbol = symbol.trim()

      if (symbol === apiName || IGNORE_SYMBOLS.has(symbol)) {
        return
      }

      // Type annotations generally have no explanation. This keeps parameter and
      // function names from becoming false-positive API links.
      if (this.tokens[line]?.[column]?.explanation != null) {
        return
      }

      let linkElement: Element | undefined
      let docFile = docFilesLookup.get(symbol)
      if (docFile !== undefined) {
        linkElement = createLink(symbol, {
          href: withVersion(routes.api.document.href({ slug: docFile.urlPath }), version),
        })
      } else if (Object.hasOwn(MDN_SYMBOLS, symbol)) {
        linkElement = createLink(symbol, {
          href: MDN_SYMBOLS[symbol as keyof typeof MDN_SYMBOLS],
          target: '_blank',
        })
      }

      if (linkElement !== undefined) {
        node.children = [
          ...(leadingSpaces > 0 ? createSpacer(leadingSpaces) : []),
          linkElement,
          ...(trailingSpaces > 0 ? createSpacer(trailingSpaces) : []),
        ]
      }
    },
  }
}

function createSpacer(length: number) {
  return [
    {
      type: 'text',
      value: ' '.repeat(length),
    } as const,
  ]
}

function createLink(
  text: string,
  properties: { href: HTMLAnchorElement['href']; target?: HTMLAnchorElement['target'] },
): Element {
  return {
    type: 'element',
    tagName: 'a',
    properties,
    children: [{ type: 'text', value: text }],
  }
}
