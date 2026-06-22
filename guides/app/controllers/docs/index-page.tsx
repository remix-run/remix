import type { Handle } from 'remix/ui'

import type { AppContext } from '../../middleware/render.ts'
import { loadDocsChapterSummaries } from './markdown-chapters.tsx'
import type { DocsChapterSummary } from './markdown-chapters.tsx'
import { DocsDocument, docsResponseInit } from './shared.tsx'

export async function docsIndexHandler({ render }: AppContext) {
  let chapters = await loadDocsChapterSummaries()

  return render(<DocsIndexPage chapters={chapters} />, docsResponseInit)
}

type DocsIndexPageProps = {
  chapters: DocsChapterSummary[]
}

function DocsIndexPage(handle: Handle<DocsIndexPageProps>) {
  return () => (
    <DocsDocument
      title="Remix Docs"
      description="Guides, explanations, examples, and tutorials for learning Remix."
    >
      <div class="docs-index">
        <header class="docs-index__header">
          <p class="docs-chapter-eyebrow text-red-brand">Remix Docs</p>
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

function ChapterCard(handle: Handle<{ chapter: DocsChapterSummary }>) {
  return () => {
    let chapter = handle.props.chapter

    return (
      <li class="chapter-card">
        <div class="chapter-card__eyebrow">{chapter.chapter}</div>
        <h2 class="rmx-page-title rmx-page-title-xs chapter-card__title">
          <a href={chapter.href}>{chapter.title}</a>
        </h2>
        <p class="rmx-page-body rmx-page-body-sm chapter-card__description">
          {chapter.description}
        </p>
        <ul class="chapter-card__links">
          {chapter.sections.map((section) => (
            <li key={section.id}>
              <a href={`${chapter.href}#${section.id}`} rmx-document>
                {section.title}
              </a>
            </li>
          ))}
        </ul>
      </li>
    )
  }
}
