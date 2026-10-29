import { Frame, type RemixNode } from 'remix/component'
import type { Database } from 'remix/data-table'
import { SuperHeaders } from 'remix/headers'
import type { RenderFunction } from 'remix/middleware/render'

import { categoriesBySection, sections } from '../data/schema.ts'
import { frames } from '../routes.ts'
import { Layout } from '../ui/layout.tsx'
import { DocumentTitle } from '../ui/public/document-title.tsx'

/**
 * - `shared`: the content is the same for every visitor, so browsers and CDNs may cache it.
 * - `private`: the content belongs to one visitor (their cart) and must always be fresh.
 */
export type PageCache = 'shared' | 'private'

export interface PageContext {
  request: Request
  render: RenderFunction
  db: Database
}

export interface Page {
  title: string
  content: RemixNode
  cache: PageCache
  status?: number
}

/**
 * Renders either the page's content alone or the full document around it.
 *
 * Content-frame navigations send `X-Remix-Target: content`, so they get just the content: a small
 * response that can be shared and cached. Everything else gets the full document, whose content
 * frame `render()` fills by requesting this same URL as a frame.
 *
 * Actions load their data for document requests too, so the document gets the right status code
 * and `<title>`. The catalog's queries are small indexed SQLite lookups, so running them twice is
 * simpler than avoiding it.
 */
export async function renderPage(context: PageContext, page: Page): Promise<Response> {
  let { request, render, db } = context
  let status = page.status ?? 200

  if (request.headers.get('X-Remix-Target') === frames.content) {
    return render(
      <>
        <DocumentTitle title={page.title} />
        {page.content}
      </>,
      { status, headers: createContentHeaders(page.cache, status) },
    )
  }

  let navigation = await db.findMany(sections, {
    orderBy: ['position', 'asc'],
    with: { categories: categoriesBySection },
  })

  return render(
    <Layout title={page.title} navigation={navigation}>
      <Frame name={frames.content} src={request.url} />
    </Layout>,
    { status, headers: createDocumentHeaders() },
  )
}

function createContentHeaders(cache: PageCache, status: number): Headers {
  let headers = new SuperHeaders({ vary: ['X-Remix-Target'] })

  if (cache === 'shared' && status === 200) {
    // Fresh for five minutes, then served instantly while the browser or CDN revalidates.
    headers.cacheControl = { public: true, maxAge: 300, staleWhileRevalidate: 86400 }
  } else {
    headers.cacheControl = { private: true, noStore: true }
  }

  return headers
}

function createDocumentHeaders(): Headers {
  // The document embeds the visitor's cart summary, so it is private. `no-cache` makes the browser
  // revalidate every time, and conditionalGet() answers unchanged pages with empty 304s.
  return new SuperHeaders({
    cacheControl: { private: true, noCache: true },
    vary: ['X-Remix-Target'],
  })
}
