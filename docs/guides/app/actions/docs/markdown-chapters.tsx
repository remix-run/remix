import { readdir, readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import type { Handle } from 'remix/ui'

import type { AppContext } from '../../router.ts'
import { routes } from '../../routes.ts'
import { readMarkdownChapterSummary, renderMarkdownChapter } from './markdown/render.tsx'
import type { MarkdownChapter, MarkdownChapterSummary } from './markdown/types.ts'
import { DocsChapter } from './layout.tsx'

export type DocsChapterSummary = Omit<MarkdownChapterSummary, 'published' | 'listed'> & {
  order: number
  slug: string
  href: string
  disabled: boolean
}

export type DocsNavigationItem = Pick<DocsChapterSummary, 'order' | 'slug' | 'href' | 'title'> & {
  disabled: boolean
}

type ChapterFile = {
  order: number
  slug: string
  fileUrl: URL
  filePath: string
  chapter: string
  href: string
}

type LoadedDocsChapterSummary = MarkdownChapterSummary &
  ChapterFile & {
    mtime: number
  }

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
  let chapter = await loadDocsChapter(context.params.chapter)

  if (!chapter) {
    return new Response('Not Found', { status: 404 })
  }

  return context.render(<MarkdownChapterPage {...chapter} />)
}

export async function loadDocsChapterSummaries(
  environment = process.env.NODE_ENV,
): Promise<DocsChapterSummary[]> {
  let summaries = await loadChapterSummaries(environment)
  return summaries.map((summary) => toDocsChapterSummary(summary, environment))
}

export async function loadDocsIndexChapterSummaries(
  environment = process.env.NODE_ENV,
): Promise<DocsChapterSummary[]> {
  let summaries = await loadAllChapterSummaries()
  return summaries
    .filter((summary) => summary.listed)
    .map((summary) => toDocsChapterSummary(summary, environment))
}

export async function loadDocsNavigationItems(
  environment = process.env.NODE_ENV,
): Promise<DocsNavigationItem[]> {
  let summaries = await loadAllChapterSummaries()
  return createDocsNavigationItems(summaries, environment)
}

async function loadDocsChapter(slug: string): Promise<LoadedMarkdownChapter | undefined> {
  let environment = process.env.NODE_ENV
  let allSummaries = await loadAllChapterSummaries()
  let summaries = filterChapterSummaries(allSummaries, environment)
  let index = summaries.findIndex((summary) => summary.slug === slug)
  let summary = summaries[index]

  if (!summary) {
    return undefined
  }

  let disabledLinkPaths =
    environment === 'production'
      ? new Set(allSummaries.filter((summary) => !summary.published).map((summary) => summary.href))
      : undefined
  let chapter = await loadRenderedChapter(summary, disabledLinkPaths)
  let previous = summaries[index - 1]
  let next = summaries[index + 1]

  return {
    ...chapter,
    slug: summary.slug,
    chapter: summary.chapter,
    chapters: createDocsNavigationItems(allSummaries, environment),
    previous: getNavigation(previous),
    next: getNavigation(next),
  }
}

async function loadChapterSummaries(
  environment = process.env.NODE_ENV,
): Promise<LoadedDocsChapterSummary[]> {
  return filterChapterSummaries(await loadAllChapterSummaries(), environment)
}

async function loadAllChapterSummaries(): Promise<LoadedDocsChapterSummary[]> {
  let files = await loadChapterFiles()
  return Promise.all(files.map(loadCachedSummary))
}

function filterChapterSummaries(
  summaries: LoadedDocsChapterSummary[],
  environment: string | undefined,
): LoadedDocsChapterSummary[] {
  return environment === 'production' ? summaries.filter((summary) => summary.published) : summaries
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
// the markdown render.
const renderCache = new Map<string, { mtime: number; chapter: MarkdownChapter }>()

async function loadRenderedChapter(
  summary: LoadedDocsChapterSummary,
  disabledLinkPaths: ReadonlySet<string> | undefined,
): Promise<MarkdownChapter> {
  let { mtime } = await stat(summary.filePath)
  let cacheKey = `${summary.filePath}:${disabledLinkPaths === undefined ? 'all' : 'published'}`
  let cached = renderCache.get(cacheKey)
  if (cached && cached.mtime === mtime.getTime()) {
    return cached.chapter
  }

  let markdown = await readFile(summary.fileUrl, 'utf8')
  let chapter = await renderMarkdownChapter(markdown, {
    chapter: summary.chapter,
    filePath: summary.filePath,
    disabledLinkPaths,
  })

  renderCache.set(cacheKey, { mtime: mtime.getTime(), chapter })
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

function toDocsChapterSummary(
  summary: LoadedDocsChapterSummary,
  environment: string | undefined,
): DocsChapterSummary {
  return {
    order: summary.order,
    slug: summary.slug,
    href: summary.href,
    chapter: summary.chapter,
    title: summary.title,
    description: summary.description,
    sections: summary.sections,
    disabled: isDisabled(summary, environment),
  }
}

function createDocsNavigationItems(
  summaries: LoadedDocsChapterSummary[],
  environment: string | undefined,
): DocsNavigationItem[] {
  return summaries
    .filter((summary) => summary.listed)
    .map((summary) => ({
      order: summary.order,
      slug: summary.slug,
      href: summary.href,
      title: summary.title,
      disabled: isDisabled(summary, environment),
    }))
}

function isDisabled(summary: LoadedDocsChapterSummary, environment: string | undefined): boolean {
  return environment === 'production' && !summary.published
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
