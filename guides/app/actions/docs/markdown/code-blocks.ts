import type {
  Element,
  ElementContent,
  RootContent as HastRootContent,
  Root as HastRoot,
} from 'hast'
import { codeToHast, type ShikiTransformer } from 'shiki'
import { visit } from 'unist-util-visit'

import type { CodeBlock, CodeBlockInfo } from './types.ts'

const shikiThemes = {
  light: 'github-light',
  dark: 'github-dark',
} as const

export function rehypeHighlightCode() {
  return async function transform(tree: HastRoot): Promise<void> {
    let codeBlocks: {
      parent: HastRoot | Element
      index: number
      codeBlock: CodeBlock
    }[] = []

    visit(tree, 'element', (node, index, parent) => {
      if (parent === undefined || index === undefined) {
        return
      }

      let codeBlock = readCodeBlock(node)
      if (codeBlock !== undefined) {
        codeBlocks.push({ parent, index, codeBlock })
      }
    })

    for (let target of codeBlocks) {
      target.parent.children[target.index] = await renderHighlightedCodeBlock(target.codeBlock)
    }
  }
}

export function readCodeBlock(pre: Element): CodeBlock | undefined {
  if (pre.tagName !== 'pre') {
    return undefined
  }

  let code = pre.children.find(
    (child): child is Element => child.type === 'element' && child.tagName === 'code',
  )
  if (code === undefined) {
    return undefined
  }

  let classNames: string[] = []
  let rawClassNames = code.properties.className ?? code.properties.class
  if (typeof rawClassNames === 'string') {
    classNames = rawClassNames.split(/\s+/)
  } else if (Array.isArray(rawClassNames)) {
    classNames = rawClassNames.filter(
      (className): className is string => typeof className === 'string',
    )
  }

  let language = classNames.find((className) => className.startsWith('language-'))
  let meta = code.data?.meta

  return {
    source: readHastText(code).replace(/\n$/, ''),
    language: language?.slice('language-'.length),
    meta: typeof meta === 'string' ? meta : undefined,
  }
}

function readHastText(node: HastRootContent): string {
  if (node.type === 'text') {
    return node.value
  }

  if (node.type === 'element') {
    return node.children.map((child) => readHastText(child)).join('')
  }

  return ''
}

export async function renderHighlightedCodeBlock(codeBlock: CodeBlock): Promise<Element> {
  let info = readCodeBlockInfo(codeBlock.language, codeBlock.meta)
  let pre: Element

  try {
    let highlighted = await codeToHast(codeBlock.source, {
      lang: info.language,
      themes: shikiThemes,
      transformers: [codeBlockTransformer(info.highlightedLines)],
    })

    pre =
      highlighted.children.find(
        (child): child is Element => child.type === 'element' && child.tagName === 'pre',
      ) ?? renderPlainCodePre(codeBlock.source, info.highlightedLines)
  } catch {
    pre = renderPlainCodePre(codeBlock.source, info.highlightedLines)
  }

  return wrapCodeBlock(pre, info.filename)
}

export function readCodeBlockInfo(
  language: string | undefined,
  metaValue: string | undefined,
): CodeBlockInfo {
  // When a fence has no language, remark assigns the info string (e.g. `[1-3]` or
  // `highlight=2-4`) to `language` instead of `meta`. Reclaim it as meta in that case.
  let meta = metaValue?.trim() ?? ''
  if (language && looksLikeMeta(language)) {
    meta = `${meta} ${language}`.trim()
    language = undefined
  }

  let filename = (
    readCodeBlockMetaParameter(meta, 'filename') ?? readCodeBlockMetaParameter(meta, 'title')
  )?.trim()

  let info: CodeBlockInfo = {
    language: language && language !== '' ? language : 'plaintext',
    highlightedLines: readHighlightedLines(meta),
  }
  if (filename && filename !== '') {
    info.filename = filename
  }
  return info
}

export function looksLikeMeta(value: string): boolean {
  return value.startsWith('[') || value.startsWith('{') || value.includes('=')
}

export function readCodeBlockMetaParameter(meta: string, key: string): string | undefined {
  let escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  let match = new RegExp(`(?:^|\\s)${escapedKey}=("([^"]*)"|'([^']*)'|([^\\s]+))`).exec(meta)
  return match?.[2] ?? match?.[3] ?? match?.[4]
}

// Highlighted line specs come from bare `{1-3}` / `[1-3]` groups and `highlight=`
// / `lines=` parameters.
export function readHighlightedLines(meta: string): Set<number> {
  let highlightedLines = new Set<number>()
  let groups = [
    ...meta.matchAll(/(?:^|\s)\{([^}]*)\}(?=\s|$)/g),
    ...meta.matchAll(/(?:^|\s)\[([^\]]*)\](?=\s|$)/g),
  ].map((match) => match[1])
  let specs = [
    ...groups,
    readCodeBlockMetaParameter(meta, 'highlight'),
    readCodeBlockMetaParameter(meta, 'lines'),
  ]

  for (let spec of specs) {
    addLineNumbers(highlightedLines, spec)
  }

  return highlightedLines
}

export function addLineNumbers(highlightedLines: Set<number>, value: string | undefined): void {
  value = value?.trim() ?? ''

  if (
    (value.startsWith('[') && value.endsWith(']')) ||
    (value.startsWith('{') && value.endsWith('}'))
  ) {
    value = value.slice(1, -1)
  }

  for (let part of value.split(',')) {
    let segment = part.trim()
    if (segment === '') {
      continue
    }

    let rangeMatch = /^(\d+)-(\d+)$/.exec(segment)
    if (rangeMatch?.[1] !== undefined && rangeMatch[2] !== undefined) {
      let start = Number.parseInt(rangeMatch[1], 10)
      let end = Number.parseInt(rangeMatch[2], 10)
      if (start > 0 && end >= start) {
        for (let line = start; line <= end; line++) {
          highlightedLines.add(line)
        }
      }
      continue
    }

    if (/^\d+$/.test(segment)) {
      let line = Number.parseInt(segment, 10)
      if (line > 0) {
        highlightedLines.add(line)
      }
    }
  }
}

function codeBlockTransformer(highlightedLines: Set<number>): ShikiTransformer {
  return {
    name: 'remix-guides-code-block',
    line(lineElement, line) {
      if (highlightedLines.has(line)) {
        lineElement.properties['data-highlighted-line'] = ''
      }
    },
  }
}

export function renderPlainCodePre(source: string, highlightedLines: Set<number>): Element {
  let lines = source.split('\n')

  return {
    type: 'element',
    tagName: 'pre',
    properties: {},
    children: [
      {
        type: 'element',
        tagName: 'code',
        properties: {},
        children: lines.map((line, index): Element => {
          let lineNumber = index + 1
          let properties: Element['properties'] = { class: 'line' }
          if (highlightedLines.has(lineNumber)) {
            properties['data-highlighted-line'] = ''
          }

          return {
            type: 'element',
            tagName: 'span',
            properties,
            children: [
              {
                type: 'text',
                value: line + (index === lines.length - 1 ? '' : '\n'),
              },
            ],
          }
        }),
      },
    ],
  }
}

function wrapCodeBlock(pre: Element, filename?: string): Element {
  let children: ElementContent[] = []

  if (filename !== undefined) {
    children.push({
      type: 'element',
      tagName: 'div',
      properties: {
        class: 'docs-code-block__filename',
        'data-code-block-filename': '',
      },
      children: [{ type: 'text', value: filename }],
    })
  }

  children.push(pre)
  children.push({
    type: 'element',
    tagName: 'button',
    properties: {
      class: 'docs-code-block__copy',
      type: 'button',
      'data-code-block-copy': '',
      'aria-label': 'Copy code to clipboard',
    },
    children: [
      {
        type: 'element',
        tagName: 'span',
        properties: { class: 'docs-code-block__copy-label' },
        children: [{ type: 'text', value: 'Copy code to clipboard' }],
      },
    ],
  })

  return {
    type: 'element',
    tagName: 'div',
    properties: {
      class: 'docs-code-block',
      'data-code-block': '',
    },
    children,
  }
}
