import type { Handle } from 'remix/ui'

import type { AppContext } from '../../router.ts'
import { getDocsChapterCacheInputs, loadDocsChapterSummaries } from './markdown-chapters.tsx'
import type { DocsChapterSummary } from './markdown-chapters.tsx'
import { DocsDocument } from './layout.tsx'
import { docsEtag, docsResponseInit, notModifiedDocsResponse } from './cache.ts'

export async function docsIndexHandler(context: AppContext) {
  let chapters = await loadDocsChapterSummaries()
  let etag = docsEtag('index', getDocsChapterCacheInputs(chapters))

  let notModified = notModifiedDocsResponse(context.request, etag)
  if (notModified) {
    return notModified
  }

  return context.render(<DocsIndexPage chapters={chapters} />, docsResponseInit(etag))
}

type DocsIndexPageProps = {
  chapters: DocsChapterSummary[]
}

function DocsIndexPage(handle: Handle<DocsIndexPageProps>) {
  return () => (
    <DocsDocument
      title="Remix Docs"
      description="Guides, explanations, examples, and tutorials for learning Remix."
      chapters={handle.props.chapters}
    >
      <div class="docs-index">
        <header class="docs-index__header">
          <p class="docs-chapter-eyebrow docs-accent">Remix Guides</p>
          <h1 class="rmx-page-title">Learn Remix from the request up.</h1>
          <p class="rmx-page-body">
            These guide chapters introduce Remix at a high level, then progressively deepen into
            routing, rendering, interactivity, data, security, assets, testing, production,
            examples, and tutorials.
          </p>
          <p class="rmx-page-body">
            API reference lives separately at <a href="https://api.remix.run">api.remix.run</a>.
          </p>
        </header>

        <ol class="docs-index__cards">
          {handle.props.chapters.map((chapter) => (
            <ChapterCard key={chapter.slug} chapter={chapter} />
          ))}
        </ol>
      </div>
    </DocsDocument>
  )
}

export function ChapterCard(handle: Handle<{ chapter: DocsChapterSummary }>) {
  return () => {
    let chapter = handle.props.chapter

    return (
      <li class="chapter-card">
        <div class="chapter-card__heading">
          <div class="chapter-card__eyebrow">{String(chapter.order).padStart(2, '0')}</div>
          <h2 class="rmx-page-title rmx-page-title-xs chapter-card__title">
            <a href={chapter.href}>{chapter.title}</a>
          </h2>
        </div>
        <p class="rmx-page-body rmx-page-body-sm chapter-card__description">
          {chapter.description}
        </p>
        <div class="chapter-card__topics">
          <div class="chapter-card__loop">
            <ChapterTopicLinks chapter={chapter} />
            <ChapterTopicLinks chapter={chapter} clone />
          </div>
        </div>
      </li>
    )
  }
}

function ChapterTopicLinks(
  handle: Handle<{
    chapter: DocsChapterSummary
    clone?: boolean
  }>,
) {
  return () => (
    <ul
      class={`chapter-card__links${handle.props.clone ? ' chapter-card__links--clone' : ''}`}
      aria-hidden={handle.props.clone ? 'true' : undefined}
    >
      {handle.props.chapter.sections.map((section) => (
        <li key={section.id}>
          <span innerHTML={section.titleHtml} />
        </li>
      ))}
      <li class="chapter-card__separator" aria-hidden="true">
        ...
      </li>
    </ul>
  )
}
