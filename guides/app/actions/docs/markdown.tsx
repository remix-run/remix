import * as frontmatter from 'front-matter'
import { Lexer, Marked, type MarkedExtension } from 'marked'
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
  lineOffset?: number
}

export type MarkdownChapterSection = {
  id: string
  title: string
}

export type MarkdownChapter = {
  chapter: string
  title: string
  description: string
  sections: MarkdownChapterSection[]
  content: RemixNode
}

export type MarkdownChapterSummary = Omit<MarkdownChapter, 'content'>

type ChapterMetadata = Omit<MarkdownChapterSummary, 'sections'>

type Heading = {
  level: number
  title: string
  lineNumber: number
  id?: string
}

type MarkdownChunk = {
  type: 'markdown'
  source: string
  startLine: number
}

type FrameChunk = {
  type: 'frame'
  src: string
  lineNumber: number
}

type Fence = {
  char: '`' | '~'
  length: number
}

const marked = new Marked(getGuidesMarkedExtension())

export async function renderMarkdownChapter(
  source: string,
  options: MarkdownOptions,
): Promise<MarkdownChapter> {
  let { attributes, body } = parseFrontmatter(source)
  let bodyOptions = { ...options, lineOffset: getBodyLineOffset(source, body) }

  return {
    ...readChapterMetadata(attributes, options),
    sections: readMarkdownSections(body, bodyOptions),
    content: await renderMarkdownBody(body, bodyOptions),
  }
}

export function readMarkdownChapterSummary(
  source: string,
  options: MarkdownOptions,
): MarkdownChapterSummary {
  let { attributes, body } = parseFrontmatter(source)

  return {
    ...readChapterMetadata(attributes, options),
    sections: readMarkdownSections(body, {
      ...options,
      lineOffset: getBodyLineOffset(source, body),
    }),
  }
}

function getGuidesMarkedExtension(): MarkedExtension {
  return {
    async: true,
    async walkTokens(token) {
      if (token.type !== 'code') {
        return
      }

      try {
        token.text = await codeToHtml(token.text, {
          lang: token.lang || 'typescript',
          themes: {
            light: 'github-light',
            dark: 'github-dark',
          },
        })
      } catch (error) {
        console.error(`Shiki highlighting failed for token: ${JSON.stringify(token)}`)
        console.error(error)
        token.text = `<pre><code>${escapeHtml(token.text)}</code></pre>`
      }
    },
    renderer: {
      code(code) {
        return code.text
      },
      heading(token) {
        let { id, title } = parseExplicitHeadingId(token.text)
        let attrs = id ? ` id="${escapeHtml(id)}"` : ''
        let tokens = id ? Lexer.lexInline(title) : token.tokens
        return `<h${token.depth}${attrs}>${this.parser.parseInline(tokens)}</h${token.depth}>\n`
      },
      html(token) {
        return escapeHtml(token.text)
      },
    },
  }
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

function readMarkdownSections(source: string, options: MarkdownOptions): MarkdownChapterSection[] {
  let sections: MarkdownChapterSection[] = []
  let ids = new Set<string>()
  let fence: Fence | undefined
  let lines = normalizeSource(source).split('\n')

  for (let index = 0; index < lines.length; index++) {
    let line = lines[index]

    if (!fence) {
      let heading = parseHeading(line, index + 1)

      if (heading?.level === 2) {
        if (!heading.id) {
          throw markdownError(options, heading.lineNumber, 'Level-2 headings must include `{#id}`')
        }

        if (ids.has(heading.id)) {
          throw markdownError(options, heading.lineNumber, `Duplicate heading id \`${heading.id}\``)
        }

        ids.add(heading.id)
        sections.push({ id: heading.id, title: heading.title })
        continue
      }

      if (sections.length === 0 && line.trim() !== '') {
        throw markdownError(
          options,
          index + 1,
          'Expected a level-2 heading to start a docs section',
        )
      }
    }

    fence = updateFence(fence, line)
  }

  return sections
}

async function renderMarkdownBody(source: string, options: MarkdownOptions): Promise<RemixNode[]> {
  let chunks = splitFrameChunks(normalizeSource(source), 1, options)
  let nodes: RemixNode[] = []

  for (let index = 0; index < chunks.length; index++) {
    let chunk = chunks[index]

    if (chunk.type === 'frame') {
      nodes.push(<Frame key={`frame-${chunk.lineNumber}`} src={chunk.src} />)
      continue
    }

    if (chunk.source.trim() !== '') {
      nodes.push(
        <MarkdownHtml
          key={`markdown-${chunk.startLine}-${index}`}
          html={await marked.parse(chunk.source)}
        />,
      )
    }
  }

  return nodes
}

function splitFrameChunks(
  source: string,
  startLine: number,
  options: MarkdownOptions,
): Array<MarkdownChunk | FrameChunk> {
  let lines = source.split('\n')
  let chunks: Array<MarkdownChunk | FrameChunk> = []
  let markdownStart = 0
  let fence: Fence | undefined
  let index = 0

  while (index < lines.length) {
    let line = lines[index]
    let lineNumber = startLine + index
    let frameSrc = !fence ? readFrameSrc(line, options, lineNumber) : undefined

    if (frameSrc) {
      if (markdownStart < index) {
        chunks.push({
          type: 'markdown',
          source: lines.slice(markdownStart, index).join('\n'),
          startLine: startLine + markdownStart,
        })
      }

      if (lines[index + 1]?.trim() !== ':::') {
        throw markdownError(options, lineNumber, 'Expected frame directive to close with `:::`')
      }

      chunks.push({ type: 'frame', src: frameSrc, lineNumber })
      index += 2
      markdownStart = index
      continue
    }

    fence = updateFence(fence, line)
    index++
  }

  if (markdownStart < lines.length) {
    chunks.push({
      type: 'markdown',
      source: lines.slice(markdownStart).join('\n'),
      startLine: startLine + markdownStart,
    })
  }

  return chunks
}

function readFrameSrc(
  line: string,
  options: MarkdownOptions,
  lineNumber: number,
): string | undefined {
  let trimmed = line.trim()
  if (!trimmed.startsWith(':::frame')) {
    return undefined
  }

  let match = /^:::frame\s+(\S+)$/.exec(trimmed)
  if (!match) {
    throw markdownError(options, lineNumber, 'Expected frame directive syntax: `:::frame /src`')
  }

  let src = match[1]
  if (!src.startsWith('/')) {
    throw markdownError(options, lineNumber, 'Frame directive source must start with `/`')
  }

  return src
}

function MarkdownHtml(handle: Handle<{ html: string }>) {
  return () => <div class="rmx-page-body" innerHTML={handle.props.html} />
}

function parseHeading(line: string, lineNumber: number): Heading | undefined {
  let match = /^(#{1,6})\s+(.+?)\s*$/.exec(line)
  if (!match) {
    return undefined
  }

  let { id, title } = parseExplicitHeadingId(match[2])

  return {
    level: match[1].length,
    title,
    lineNumber,
    id,
  }
}

function parseExplicitHeadingId(value: string): { id?: string; title: string } {
  let idMatch = /\s+\{#([A-Za-z0-9][A-Za-z0-9_-]*)\}\s*$/.exec(value)
  if (!idMatch) {
    return { title: value }
  }

  return {
    id: idMatch[1],
    title: value.slice(0, idMatch.index).trim(),
  }
}

function updateFence(fence: Fence | undefined, line: string): Fence | undefined {
  let match = /^\s*(`{3,}|~{3,})/.exec(line)
  if (!match) {
    return fence
  }

  let marker = match[1]
  let char = marker[0]

  if (char !== '`' && char !== '~') {
    return fence
  }

  if (!fence) {
    return { char, length: marker.length }
  }

  if (char === fence.char && marker.length >= fence.length) {
    return undefined
  }

  return fence
}

function normalizeSource(source: string): string {
  return source.replace(/\r\n?/g, '\n')
}

function getBodyLineOffset(source: string, body: string): number {
  let bodyStart = source.length - body.length
  let frontmatter = source.slice(0, bodyStart)
  return (frontmatter.match(/\n/g) ?? []).length
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => `&#${char.charCodeAt(0)};`)
}

function frontmatterError(options: MarkdownOptions, message: string): Error {
  return markdownError(options, 1, `Invalid frontmatter: ${message}`)
}

function markdownError(options: MarkdownOptions, lineNumber: number, message: string): Error {
  let sourceLineNumber = lineNumber + (options.lineOffset ?? 0)
  let location = options.filePath
    ? `${options.filePath}:${sourceLineNumber}`
    : `Markdown:${sourceLineNumber}`
  return new Error(`${location}: ${message}`)
}
