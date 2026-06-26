import matter from 'gray-matter'
import GithubSlugger from 'github-slugger'
import type {
  Element,
  ElementContent,
  Root as HastRoot,
  RootContent as HastRootContent,
} from 'hast'
import { toHtml } from 'hast-util-to-html'
import type { ContainerDirective, LeafDirective } from 'mdast-util-directive'
import { toString as mdastToString } from 'mdast-util-to-string'
import type { Heading, Html, Paragraph, PhrasingContent, Root, RootContent, Text } from 'mdast'
import rehypeStringify from 'rehype-stringify'
import remarkDirective from 'remark-directive'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { codeToHast, type ShikiTransformer } from 'shiki'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'
import { Frame } from 'remix/ui'
import type { Handle, RemixNode } from 'remix/ui'

type MarkdownOptions = {
  chapter: string
  filePath?: string
}

export type MarkdownChapterSection = {
  id: string
  title: string
  titleHtml: string
}

export type MarkdownChapter = {
  chapter: string
  title: string
  description: string
  sections: MarkdownChapterSection[]
  content: RemixNode
}

export type MarkdownChapterSummary = Omit<MarkdownChapter, 'content'>

export type MarkdownFrameReference = {
  src: string
  lineNumber: number
}

type ChapterMetadata = Omit<MarkdownChapterSummary, 'sections'>

type MarkdownSegment =
  | {
      type: 'markdown'
      children: RootContent[]
      lineNumber: number
    }
  | {
      type: 'frame'
      src: string
      lineNumber: number
    }

type CodeBlock = {
  source: string
  language?: string
  meta?: string
}

type CodeBlockInfo = {
  language: string
  filename?: string
  highlightedLines: Set<number>
}

const markdownParser = unified().use(remarkParse).use(remarkGfm).use(remarkDirective)

const markdownHtmlProcessor = unified()
  .use(remarkRehype)
  .use(rehypeLinkHeadings)
  .use(rehypeHighlightCode)
  .use(rehypeStringify)

const inlineHtmlProcessor = unified().use(remarkRehype)

export async function renderMarkdownChapter(
  source: string,
  options: MarkdownOptions,
): Promise<MarkdownChapter> {
  let { attributes, root } = readMarkdownDocument(source)

  return {
    ...readChapterMetadata(attributes, options),
    sections: readMarkdownSectionsFromRoot(root),
    content: await renderMarkdownRoot(root),
  }
}

export function readMarkdownChapterSummary(
  source: string,
  options: MarkdownOptions,
): MarkdownChapterSummary {
  let { attributes, root } = readMarkdownDocument(source)

  return {
    ...readChapterMetadata(attributes, options),
    sections: readMarkdownSectionsFromRoot(root),
  }
}

export function readMarkdownFrameReferences(source: string): MarkdownFrameReference[] {
  let frames: MarkdownFrameReference[] = []
  // Parse the raw source (frontmatter included) so the reported line numbers stay
  // aligned with the source file for validation error messages.
  let root = parseMarkdownRoot(source)

  visit(root, (node) => {
    if (!isFrameDirective(node)) {
      return
    }

    let src = readFrameDirectiveSrc(node)
    if (src !== undefined) {
      frames.push({ src, lineNumber: node.position?.start.line ?? 1 })
    }
  })

  return frames
}

function readMarkdownDocument(source: string): {
  attributes: Record<string, unknown>
  root: Root
} {
  let parsed = matter(source)
  let root = parseMarkdownRoot(parsed.content)

  escapeMarkdownHtml(root)
  addHeadingIds(root)

  return { attributes: parsed.data, root }
}

function parseMarkdownRoot(source: string): Root {
  source = source.replace(/\r\n?/g, '\n')
  let tree = markdownParser.parse(source)
  let root = markdownParser.runSync(tree) as Root

  visit(root, 'textDirective', (node, index, parent) => {
    if (parent === undefined || index === undefined) {
      return
    }

    let start = node.position?.start.offset
    let end = node.position?.end.offset
    parent.children[index] = {
      type: 'text',
      value: start === undefined || end === undefined ? `:${node.name}` : source.slice(start, end),
      position: node.position,
    }
  })

  return root
}

// Raw HTML in guide markdown is rendered as escaped text, not executed, so embedded
// markup shows up literally instead of being interpreted. At the document root a raw
// HTML node has to be wrapped in a paragraph to remain a valid block; inline it's
// replaced with a plain text node.
function escapeMarkdownHtml(root: Root): void {
  visit(root, 'html', (node, index, parent) => {
    if (parent === undefined || index === undefined) {
      return
    }

    let htmlNode: Html = node
    let text: Text = {
      type: 'text',
      value: htmlNode.value,
      position: htmlNode.position,
    }

    if (parent.type === 'root') {
      let paragraph: Paragraph = {
        type: 'paragraph',
        children: [text],
        position: htmlNode.position,
      }
      parent.children[index] = paragraph
      return
    }

    parent.children[index] = text
  })
}

function addHeadingIds(root: Root): void {
  let slugger = new GithubSlugger()

  visit(root, 'heading', (node) => {
    let heading: Heading = node
    let lastChild = heading.children.at(-1)
    let explicitId: string | undefined

    if (lastChild?.type === 'text') {
      let idMatch = /\s+\{#([^}\s]+)\}\s*$/.exec(lastChild.value)
      explicitId = idMatch?.[1]

      if (idMatch !== null) {
        let text = lastChild.value.slice(0, idMatch.index)
        if (text === '') {
          heading.children.pop()
        } else {
          lastChild.value = text
        }
      }
    }

    let text = mdastToString(heading).trim()
    let data = heading.data ?? (heading.data = {})
    data.hProperties = isRecord(data.hProperties) ? data.hProperties : {}
    data.hProperties.id = explicitId ?? slugger.slug(text || 'section')
  })
}

function readChapterMetadata(
  attributes: Record<string, unknown>,
  options: MarkdownOptions,
): ChapterMetadata {
  return {
    chapter: options.chapter,
    title: readRequiredString(attributes, 'title', options),
    description: readRequiredString(attributes, 'description', options),
  }
}

function readRequiredString(
  attributes: Record<string, unknown>,
  key: string,
  options: MarkdownOptions,
): string {
  let value = attributes[key]
  if (typeof value === 'string' && value.trim() !== '') {
    return value
  }

  let location = options.filePath ? `${options.filePath}:1` : 'Markdown:1'
  throw new Error(`${location}: Invalid frontmatter: Expected \`${key}\` to be a non-empty string`)
}

function readMarkdownSectionsFromRoot(root: Root): MarkdownChapterSection[] {
  let sections: MarkdownChapterSection[] = []

  visit(root, 'heading', (node) => {
    let heading: Heading = node
    if (heading.depth !== 2) {
      return
    }

    let id = heading.data?.hProperties?.id
    sections.push({
      id: typeof id === 'string' && id.trim() !== '' ? id : 'section',
      title: mdastToString(heading).trim(),
      titleHtml: renderInlineHtml(heading.children),
    })
  })

  return sections
}

async function renderMarkdownRoot(root: Root): Promise<RemixNode[]> {
  let nodes: RemixNode[] = []
  let definitions = root.children.filter((child) => isDefinitionNode(child))

  for (let segment of splitMarkdownRoot(root)) {
    if (segment.type === 'frame') {
      nodes.push(<Frame key={`frame-${segment.lineNumber}`} src={segment.src} />)
      continue
    }

    let segmentRoot: Root = {
      type: 'root',
      children: [...definitions, ...segment.children],
    }
    let hast = await markdownHtmlProcessor.run(segmentRoot)

    nodes.push(
      <MarkdownHtml
        key={`markdown-${segment.lineNumber}-${nodes.length}`}
        html={markdownHtmlProcessor.stringify(hast)}
      />,
    )
  }

  return nodes
}

function splitMarkdownRoot(root: Root): MarkdownSegment[] {
  let segments: MarkdownSegment[] = []
  let markdownChildren: RootContent[] = []
  let markdownStartLine = 1

  for (let child of root.children) {
    if (isFrameDirective(child)) {
      pushMarkdownSegment()
      let src = readFrameDirectiveSrc(child)
      if (src !== undefined) {
        segments.push({
          type: 'frame',
          src,
          lineNumber: child.position?.start.line ?? 1,
        })
      }
      markdownStartLine = (child.position?.end.line ?? child.position?.start.line ?? 0) + 1
      continue
    }

    if (markdownChildren.length === 0) {
      markdownStartLine = child.position?.start.line ?? markdownStartLine
    }

    markdownChildren.push(child)
  }

  pushMarkdownSegment()
  return segments

  function pushMarkdownSegment(): void {
    let visibleChildren = markdownChildren.filter((child) => !isDefinitionNode(child))
    if (visibleChildren.length > 0) {
      segments.push({
        type: 'markdown',
        children: visibleChildren,
        lineNumber: markdownStartLine,
      })
    }

    markdownChildren = []
  }
}

function renderInlineHtml(children: PhrasingContent[]): string {
  let root: Root = {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children,
      },
    ],
  }
  let hast = inlineHtmlProcessor.runSync(root) as HastRoot
  let paragraph = hast.children.find((child): child is Element => isElementNamed(child, 'p'))

  return paragraph?.children.map((child) => toHtml(child)).join('') ?? ''
}

function MarkdownHtml(handle: Handle<{ html: string }>) {
  return () => <div class="rmx-page-body" innerHTML={handle.props.html} />
}

function rehypeLinkHeadings() {
  return function transform(tree: HastRoot): void {
    visit(tree, 'element', (node) => {
      if (!isLinkableHeading(node)) {
        return
      }

      let id = node.properties.id
      if (typeof id !== 'string' || id.trim() === '') {
        return
      }

      if (hasAnchorDescendant(node)) {
        return
      }

      node.children = [
        {
          type: 'element',
          tagName: 'a',
          properties: {
            class: 'docs-heading-link',
            href: `#${id}`,
          },
          children: node.children,
        },
      ]
    })
  }
}

function rehypeHighlightCode() {
  return async function transform(tree: HastRoot): Promise<void> {
    let codeBlocks: {
      parent: HastRoot | Element
      index: number
      codeBlock: CodeBlock
    }[] = []

    visit(tree, 'element', (node, index, parent) => {
      if (parent === undefined || index === undefined || !isHastParent(parent)) {
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

function readCodeBlock(pre: Element): CodeBlock | undefined {
  if (pre.tagName !== 'pre') {
    return undefined
  }

  let code = pre.children.find((child): child is Element => isElementNamed(child, 'code'))
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

async function renderHighlightedCodeBlock(codeBlock: CodeBlock): Promise<Element> {
  let info = readCodeBlockInfo(codeBlock.language, codeBlock.meta)
  let pre: Element

  try {
    let highlighted = await codeToHast(codeBlock.source, {
      lang: info.language,
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      transformers: [codeBlockTransformer(info.highlightedLines)],
    })
    pre =
      highlighted.children.find((child): child is Element => isElementNamed(child, 'pre')) ??
      renderPlainCodePre(codeBlock.source, info.highlightedLines)
  } catch {
    pre = renderPlainCodePre(codeBlock.source, info.highlightedLines)
  }

  return wrapCodeBlock(pre, info.filename)
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

function readCodeBlockInfo(
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

// A fence info string is a language unless it starts with a highlight group or
// contains a `key=value` meta parameter.
function looksLikeMeta(value: string): boolean {
  return value.startsWith('[') || value.startsWith('{') || value.includes('=')
}

function readCodeBlockMetaParameter(meta: string, key: string): string | undefined {
  let escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  let match = new RegExp(`(?:^|\\s)${escapedKey}=("([^"]*)"|'([^']*)'|([^\\s]+))`).exec(meta)
  return match?.[2] ?? match?.[3] ?? match?.[4]
}

// Collects highlighted line specs from every supported form in the fence meta:
// bare `{1-3}` / `[1-3]` groups and `highlight=` / `lines=` parameters.
function readHighlightedLines(meta: string): Set<number> {
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

function addLineNumbers(highlightedLines: Set<number>, value: string | undefined): void {
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

function renderPlainCodePre(source: string, highlightedLines: Set<number>): Element {
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

function readHastText(node: HastRootContent): string {
  if (node.type === 'text') {
    return node.value
  }

  return 'children' in node && Array.isArray(node.children)
    ? node.children.map((child) => readHastText(child)).join('')
    : ''
}

function isDefinitionNode(node: RootContent): boolean {
  return node.type === 'definition' || node.type === 'footnoteDefinition'
}

function isFrameDirective(node: unknown): node is LeafDirective | ContainerDirective {
  return (
    isRecord(node) &&
    node.name === 'frame' &&
    (node.type === 'leafDirective' || node.type === 'containerDirective')
  )
}

function readFrameDirectiveSrc(node: LeafDirective | ContainerDirective): string | undefined {
  let src = node.attributes?.src
  if (typeof src !== 'string') {
    return undefined
  }

  src = src.trim()
  return src === '' ? undefined : src
}

function isHastParent(node: unknown): node is HastRoot | Element {
  return (
    isRecord(node) &&
    (node.type === 'root' || node.type === 'element') &&
    Array.isArray(node.children)
  )
}

function isElementNamed(node: unknown, tagName: string): node is Element {
  return isRecord(node) && node.type === 'element' && node.tagName === tagName
}

function isLinkableHeading(node: Element): boolean {
  return /^h[1-6]$/.test(node.tagName)
}

function hasAnchorDescendant(node: Element): boolean {
  for (let child of node.children) {
    if (child.type !== 'element') {
      continue
    }

    if (child.tagName === 'a' || hasAnchorDescendant(child)) {
      return true
    }
  }

  return false
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
