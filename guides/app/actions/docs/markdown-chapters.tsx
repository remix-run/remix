import { readdir, readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import type { Handle } from 'remix/ui'

import type { AppContext } from '../../router.ts'
import { routes } from '../../routes.ts'
import { readMarkdownChapterSummary, renderMarkdownChapter } from './markdown/render.tsx'
import type { MarkdownChapter, MarkdownChapterSummary } from './markdown/types.ts'
import { DocsChapter } from './layout.tsx'
import { docsResponseInit, docsEtag, notModifiedDocsResponse } from './cache.ts'

export type DocsChapterSummary = MarkdownChapterSummary & {
  order: number
  slug: string
  href: string
  mtime: number
}

export type DocsNavigationItem = Pick<DocsChapterSummary, 'order' | 'slug' | 'href' | 'title'>

type ChapterFile = {
  order: number
  slug: string
  fileUrl: URL
  filePath: string
  chapter: string
  href: string
}

type LoadedDocsChapterSummary = DocsChapterSummary & ChapterFile

type DocsChapterRouteContext = AppContext & {
  params: {
    chapter: string
  }
}

type ChapterNavigation = {
  href: string
  title: string
}

type LoadedMarkdownChapter = MarkdownChapter & {
  slug: string
  chapters: DocsNavigationItem[]
  previous?: ChapterNavigation
  next?: ChapterNavigation
}

const chaptersDir = new URL('./chapters/', import.meta.url)

export async function docsChapterHandler(context: DocsChapterRouteContext) {
  let result = await loadDocsChapter(context.params.chapter)

  if (!result) {
    return new Response('Not Found', { status: 404 })
  }

  let { chapter, etag } = result
  let notModified = notModifiedDocsResponse(context.request, etag)
  if (notModified) {
    return notModified
  }

  return context.render(<MarkdownChapterPage {...chapter} />, docsResponseInit(etag))
}

export async function loadDocsChapterSummaries(): Promise<DocsChapterSummary[]> {
  let summaries = await loadChapterSummaries()
  return summaries.map(toDocsChapterSummary)
}

async function loadDocsChapter(
  slug: string,
): Promise<{ chapter: LoadedMarkdownChapter; etag: string } | undefined> {
  let summaries = await loadChapterSummaries()
  let index = summaries.findIndex((summary) => summary.slug === slug)
  let summary = summaries[index]

  if (!summary) {
    return undefined
  }

  let chapter = await loadRenderedChapter(summary)
  let previous = summaries[index - 1]
  let next = summaries[index + 1]

  return {
    chapter: {
      ...chapter,
      slug: summary.slug,
      chapter: summary.chapter,
      chapters: summaries.map(toDocsNavigationItem),
      previous: getNavigation(previous),
      next: getNavigation(next),
    },
    etag: docsEtag(`chapter:${summary.slug}`, getDocsChapterCacheInputs(summaries)),
  }
}

async function loadChapterSummaries(): Promise<LoadedDocsChapterSummary[]> {
  let files = await loadChapterFiles()
  let summaries = await Promise.all(files.map(loadCachedSummary))
  return summaries
}

// Keyed by mtime so dev edits (process stays up) invalidate without a restart.
const summaryCache = new Map<string, { mtime: number; summary: LoadedDocsChapterSummary }>()

async function loadCachedSummary(file: ChapterFile): Promise<LoadedDocsChapterSummary> {
  let { mtime } = await stat(file.filePath)
  let cached = summaryCache.get(file.filePath)
  if (cached && cached.mtime === mtime.getTime()) {
    return cached.summary
  }

  let markdown = await readFile(file.fileUrl, 'utf8')
  let summary = readMarkdownChapterSummary(markdown, {
    chapter: file.chapter,
    filePath: file.filePath,
  })

  let loaded: LoadedDocsChapterSummary = {
    ...file,
    ...summary,
    chapter: summary.chapter,
    href: file.href,
    slug: file.slug,
    mtime: mtime.getTime(),
  }

  summaryCache.set(file.filePath, { mtime: mtime.getTime(), summary: loaded })
  return loaded
}

// Navigation is attached fresh from summaries each request, so this only caches
// the render. The response ETag includes every summary mtime.
const renderCache = new Map<string, { mtime: number; chapter: MarkdownChapter }>()

async function loadRenderedChapter(summary: LoadedDocsChapterSummary): Promise<MarkdownChapter> {
  let { mtime } = await stat(summary.filePath)
  let cached = renderCache.get(summary.filePath)
  if (cached && cached.mtime === mtime.getTime()) {
    return cached.chapter
  }

  let markdown = await readFile(summary.fileUrl, 'utf8')
  let chapter = await renderMarkdownChapter(markdown, {
    chapter: summary.chapter,
    filePath: summary.filePath,
  })

  renderCache.set(summary.filePath, { mtime: mtime.getTime(), chapter })
  return chapter
}

async function loadChapterFiles(): Promise<ChapterFile[]> {
  let files: ChapterFile[] = []

  for (let entry of await readdir(chaptersDir, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue
    }

    let parsed = parseChapterFilename(entry.name)
    if (!parsed) {
      continue
    }

    let fileUrl = new URL(entry.name, chaptersDir)
    files.push({
      ...parsed,
      fileUrl,
      filePath: fileURLToPath(fileUrl),
      chapter: `Chapter ${parsed.order}`,
      href: routes.docs.chapter.href({ chapter: parsed.slug }),
    })
  }

  return files.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug))
}

export function parseChapterFilename(
  fileName: string,
): Pick<ChapterFile, 'order' | 'slug'> | undefined {
  let match = /^(\d+)-([a-z0-9][a-z0-9-]*)\.md$/.exec(fileName)
  if (!match) {
    return undefined
  }

  let order = Number.parseInt(match[1], 10)
  if (!Number.isSafeInteger(order) || order < 1) {
    return undefined
  }

  return { order, slug: match[2] }
}

export function getDocsChapterCacheInputs(
  summaries: Iterable<DocsChapterSummary>,
): Array<string | number> {
  let inputs: Array<string | number> = []

  for (let summary of summaries) {
    inputs.push(summary.mtime, summary.order, summary.slug, summary.href, summary.title)
  }

  return inputs
}

function toDocsChapterSummary(summary: LoadedDocsChapterSummary): DocsChapterSummary {
  return {
    order: summary.order,
    slug: summary.slug,
    href: summary.href,
    chapter: summary.chapter,
    title: summary.title,
    description: summary.description,
    sections: summary.sections,
    mtime: summary.mtime,
  }
}

function toDocsNavigationItem(summary: LoadedDocsChapterSummary): DocsNavigationItem {
  return {
    order: summary.order,
    slug: summary.slug,
    href: summary.href,
    title: summary.title,
  }
}

function getNavigation(
  summary: LoadedDocsChapterSummary | undefined,
): ChapterNavigation | undefined {
  return summary ? { href: summary.href, title: summary.title } : undefined
}

function MarkdownChapterPage(handle: Handle<LoadedMarkdownChapter>) {
  return () => (
    <DocsChapter
      slug={handle.props.slug}
      chapter={handle.props.chapter}
      title={handle.props.title}
      description={handle.props.description}
      chapters={handle.props.chapters}
      previous={handle.props.previous}
      next={handle.props.next}
      sections={handle.props.sections}
    >
      {handle.props.content}
    </DocsChapter>
  )
}
