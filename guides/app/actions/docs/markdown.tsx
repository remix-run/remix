import * as frontmatter from 'front-matter'
import { Lexer, Marked, type MarkedExtension, type Token, type Tokens } from 'marked'
import { codeToHtml } from 'shiki'
import { Frame } from 'remix/ui'
import type { Handle, RemixNode } from 'remix/ui'

// front-matter's CommonJS default is callable at runtime, but its NodeNext namespace
// type is not, so keep the interop assertion isolated here.
const parseFrontmatter = frontmatter.default as unknown as (markdown: string) => {
  attributes: Record<string, unknown>
  body: string
}

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

type FrameToken = Tokens.Generic & {
  type: 'frame'
  src: string
}

type CodeBlockToken = Tokens.Code & {
  filename?: string
}

type CodeBlockInfo = {
  language: string
  filename?: string
  highlightedLines: Set<number>
}

type HeadingContent = {
  id: string
  markdown: string
  text: string
  html: string
}

const marked = new Marked(getGuidesMarkedExtension({ highlightCode: true }))
const inlineMarked = new Marked(getGuidesMarkedExtension())

export async function renderMarkdownChapter(
  source: string,
  options: MarkdownOptions,
): Promise<MarkdownChapter> {
  let { attributes, body } = parseFrontmatter(source)

  return {
    ...readChapterMetadata(attributes, options),
    sections: readMarkdownSections(body),
    content: await renderMarkdownBody(body),
  }
}

export function readMarkdownChapterSummary(
  source: string,
  options: MarkdownOptions,
): MarkdownChapterSummary {
  let { attributes, body } = parseFrontmatter(source)

  return {
    ...readChapterMetadata(attributes, options),
    sections: readMarkdownSections(body),
  }
}

export function readMarkdownFrameReferences(source: string): MarkdownFrameReference[] {
  let frames: MarkdownFrameReference[] = []
  let lineNumber = 1

  for (let token of marked.lexer(normalizeSource(source))) {
    if (isFrameToken(token)) {
      frames.push({ src: token.src, lineNumber })
    }

    lineNumber += countLineBreaks(token.raw)
  }

  return frames
}

function getGuidesMarkedExtension(options: { highlightCode?: boolean } = {}): MarkedExtension {
  let extension: MarkedExtension = {
    extensions: [
      {
        name: 'frame',
        level: 'block',
        start(src) {
          return /^:::frame[ \t]+/m.exec(src)?.index
        },
        tokenizer(src) {
          let match = /^:::frame[ \t]+(\S+)[ \t]*\n:::[ \t]*(?:\n|$)/.exec(src)
          let frameSrc = match?.[1]
          if (!match || frameSrc === undefined) {
            return undefined
          }

          return {
            type: 'frame',
            raw: match[0],
            src: frameSrc,
          }
        },
        renderer(token) {
          return escapeHtml(token.raw)
        },
      },
    ],
    renderer: {
      code(code) {
        let codeBlock = readCodeBlockInfo(code.lang)
        let codeToken: CodeBlockToken = code
        let filename = codeToken.filename ?? codeBlock.filename

        return renderCodeBlock(
          code.escaped ? code.text : `<pre><code>${escapeHtml(code.text)}</code></pre>\n`,
          filename,
        )
      },
      heading(token) {
        let heading = readHeadingContent(token.text)
        let tokens = Lexer.lexInline(heading.markdown)
        return `<h${token.depth} id="${escapeHtml(heading.id)}">${this.parser.parseInline(
          tokens,
        )}</h${token.depth}>\n`
      },
      html(token) {
        return escapeHtml(token.text)
      },
    },
  }

  if (options.highlightCode) {
    extension.async = true
    extension.walkTokens = async (token) => {
      if (!isCodeToken(token)) {
        return
      }

      let codeBlock = readCodeBlockInfo(token.lang)
      let codeToken: CodeBlockToken = token
      token.lang = codeBlock.language
      if (codeBlock.filename !== undefined) {
        codeToken.filename = codeBlock.filename
      }

      try {
        let html = await codeToHtml(token.text, {
          lang: codeBlock.language,
          themes: {
            light: 'github-light',
            dark: 'github-dark',
          },
        })
        token.text = applyHighlightedLinesToCodeHtml(html, codeBlock.highlightedLines)
        token.escaped = true
      } catch {
        token.text = renderPlainCodeHtml(token.text, codeBlock.highlightedLines)
        token.escaped = true
      }
    }
  }

  return extension
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

  throw frontmatterError(options, `Expected \`${key}\` to be a non-empty string`)
}

function readMarkdownSections(source: string): MarkdownChapterSection[] {
  let sections: MarkdownChapterSection[] = []
  let tokens = marked.lexer(normalizeSource(source))

  for (let token of tokens) {
    if (token.type !== 'heading' || token.depth !== 2) {
      continue
    }

    let heading = readHeadingContent(token.text)
    sections.push({ id: heading.id, title: heading.text, titleHtml: heading.html })
  }

  return sections
}

async function renderMarkdownBody(source: string): Promise<RemixNode[]> {
  let tokens = marked.lexer(normalizeSource(source))
  let nodes: RemixNode[] = []
  let markdown = ''
  let markdownStartLine = 1
  let lineNumber = 1

  for (let token of tokens) {
    if (isFrameToken(token)) {
      if (markdown.trim() !== '') {
        nodes.push(
          <MarkdownHtml
            key={`markdown-${markdownStartLine}-${nodes.length}`}
            html={await marked.parse(markdown)}
          />,
        )
      }

      markdown = ''
      nodes.push(<Frame key={`frame-${lineNumber}`} src={token.src} />)
      lineNumber += countLineBreaks(token.raw)
      markdownStartLine = lineNumber
      continue
    }

    if (markdown === '') {
      markdownStartLine = lineNumber
    }

    markdown += token.raw
    lineNumber += countLineBreaks(token.raw)
  }

  if (markdown.trim() !== '') {
    nodes.push(
      <MarkdownHtml
        key={`markdown-${markdownStartLine}-${nodes.length}`}
        html={await marked.parse(markdown)}
      />,
    )
  }

  return nodes
}

function MarkdownHtml(handle: Handle<{ html: string }>) {
  return () => <div class="rmx-page-body" innerHTML={handle.props.html} />
}

function renderCodeBlock(html: string, filename?: string): string {
  let filenameHeader =
    filename === undefined
      ? ''
      : `<div class="docs-code-block__filename" data-code-block-filename>${escapeHtml(
          filename,
        )}</div>`

  return `<div class="docs-code-block" data-code-block>${filenameHeader}${html}<button class="docs-code-block__copy" type="button" data-code-block-copy aria-label="Copy code to clipboard"><span class="docs-code-block__copy-label">Copy code to clipboard</span></button></div>`
}

function readCodeBlockInfo(value: string | undefined): CodeBlockInfo {
  let info = value?.trim()
  if (!info) {
    return { language: 'plaintext', highlightedLines: new Set() }
  }

  let [firstPart = '', ...restParts] = info.split(/\s+/)
  let hasLanguage =
    firstPart !== '' &&
    !firstPart.includes('=') &&
    !firstPart.startsWith('{') &&
    !firstPart.startsWith('[')
  let language = hasLanguage ? firstPart : 'plaintext'
  let meta = hasLanguage ? restParts.join(' ') : info
  let filename = readCodeBlockFilename(meta)
  let highlightedLines = readCodeBlockHighlightedLines(meta)

  return filename === undefined
    ? { language, highlightedLines }
    : { language, filename, highlightedLines }
}

function readCodeBlockFilename(meta: string): string | undefined {
  if (meta.trim() === '') {
    return undefined
  }

  let params = new URLSearchParams(meta.trim().split(/\s+/).join('&'))
  let filename = params.get('filename')?.trim()
  if (!filename) {
    return undefined
  }

  filename = stripCodeBlockMetaQuotes(filename)
  return filename === '' ? undefined : filename
}

function readCodeBlockHighlightedLines(meta: string): Set<number> {
  let highlightedLines = new Set<number>()
  let braceMatch = /(?:^|\s)\{([^}]*)\}(?=\s|$)/.exec(meta)
  let bracketMatch = /(?:^|\s)\[([^\]]*)\](?=\s|$)/.exec(meta)

  if (braceMatch?.[1]) {
    addLineNumbers(highlightedLines, braceMatch[1])
  }

  if (bracketMatch?.[1]) {
    addLineNumbers(highlightedLines, bracketMatch[1])
  }

  if (meta.trim() !== '') {
    let params = new URLSearchParams(meta.trim().split(/\s+/).join('&'))
    addLineNumbers(highlightedLines, params.get('highlight') ?? '')
    addLineNumbers(highlightedLines, params.get('lines') ?? '')
  }

  return highlightedLines
}

function addLineNumbers(highlightedLines: Set<number>, value: string): void {
  value = stripLineHighlightWrapper(value)

  for (let part of value.split(',')) {
    let segment = part.trim()
    if (segment === '') {
      continue
    }

    let rangeMatch = /^(\d+)-(\d+)$/.exec(segment)
    if (rangeMatch?.[1] && rangeMatch[2]) {
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

function stripLineHighlightWrapper(value: string): string {
  value = value.trim()
  let firstChar = value[0]
  let lastChar = value[value.length - 1]

  if ((firstChar === '[' && lastChar === ']') || (firstChar === '{' && lastChar === '}')) {
    return value.slice(1, -1)
  }

  return value
}

function applyHighlightedLinesToCodeHtml(html: string, highlightedLines: Set<number>): string {
  let lineNumber = 0
  let highlightedHtml = html.replace(/<span class="line">/g, (match) => {
    lineNumber++
    return highlightedLines.has(lineNumber) ? '<span class="line" data-highlighted-line>' : match
  })

  return normalizeCodeHtmlLineBreaks(highlightedHtml)
}

function normalizeCodeHtmlLineBreaks(html: string): string {
  return html.replace(/<\/span>\n(?=<span class="line")/g, '\n</span>')
}

function renderPlainCodeHtml(source: string, highlightedLines: Set<number>): string {
  let lines = source.split('\n')
  let code = lines
    .map((line, index) => {
      let lineNumber = index + 1
      let highlightedAttribute = highlightedLines.has(lineNumber) ? ' data-highlighted-line' : ''
      return `<span class="line"${highlightedAttribute}>${escapeHtml(line)}\n</span>`
    })
    .join('')

  return `<pre><code>${code}</code></pre>`
}

function stripCodeBlockMetaQuotes(value: string): string {
  let firstChar = value[0]
  let lastChar = value[value.length - 1]

  if ((firstChar === '"' || firstChar === "'") && lastChar === firstChar) {
    return value.slice(1, -1).trim()
  }

  return value
}

function readHeadingContent(value: string): HeadingContent {
  let { id, markdown } = parseExplicitHeadingId(value)
  let text = readInlineText(markdown)

  return {
    id: id ?? slugify(text),
    markdown,
    text,
    html: inlineMarked.parseInline(markdown, { async: false }),
  }
}

function parseExplicitHeadingId(value: string): { id?: string; markdown: string } {
  let idMatch = /\s+\{#([^}\s]+)\}\s*$/.exec(value)
  if (!idMatch) {
    return { markdown: value.trim() }
  }

  return {
    id: idMatch[1],
    markdown: value.slice(0, idMatch.index).trim(),
  }
}

function readInlineText(markdown: string): string {
  return Lexer.lexInline(markdown)
    .map((token) => readTokenText(token))
    .join('')
    .trim()
}

function readTokenText(token: Token): string {
  if ('tokens' in token && Array.isArray(token.tokens)) {
    return token.tokens.map((child) => readTokenText(child)).join('')
  }

  if (token.type === 'br') {
    return ' '
  }

  if ('text' in token && typeof token.text === 'string') {
    return token.text
  }

  return ''
}

function slugify(value: string): string {
  let slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || 'section'
}

function isFrameToken(token: Token): token is FrameToken {
  return token.type === 'frame' && 'src' in token && typeof token.src === 'string'
}

function isCodeToken(token: Token): token is Tokens.Code {
  return token.type === 'code' && 'text' in token && typeof token.text === 'string'
}

function countLineBreaks(source: string): number {
  return (source.match(/\n/g) ?? []).length
}

function normalizeSource(source: string): string {
  return source.replace(/\r\n?/g, '\n')
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => `&#${char.charCodeAt(0)};`)
}

function frontmatterError(options: MarkdownOptions, message: string): Error {
  return markdownError(options, 1, `Invalid frontmatter: ${message}`)
}

function markdownError(options: MarkdownOptions, lineNumber: number, message: string): Error {
  let location = options.filePath ? `${options.filePath}:${lineNumber}` : `Markdown:${lineNumber}`
  return new Error(`${location}: ${message}`)
}
