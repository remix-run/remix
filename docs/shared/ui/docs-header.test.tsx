import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import { renderToString } from 'remix/ui/server'

import { createDocsNavigationLinks, DocsHeader } from './docs-header.tsx'
import type { DocsNavigationLink } from './docs-header.tsx'

const navigationLinks = [
  { href: '/guides', label: 'Guides', current: 'location' },
  { href: '/api', label: 'API' },
] satisfies readonly DocsNavigationLink[]

describe('createDocsNavigationLinks', () => {
  it('returns the six absolute links in navigation order', () => {
    let links = createDocsNavigationLinks()

    assert.deepEqual(
      [...links],
      [
        ['guides', { href: 'https://guides.remix.run/', label: 'Guides' }],
        ['api', { href: 'https://api.remix.run', label: 'API' }],
        ['blog', { href: 'https://remix.run/blog', label: 'Blog' }],
        ['jam', { href: 'https://remix.run/jam/2026', label: 'Jam' }],
        ['store', { href: 'https://shop.remix.run', label: 'Store' }],
        ['github', { href: 'https://github.com/remix-run/remix', label: 'GitHub' }],
      ],
    )
  })

  it('retains order when a caller replaces an existing link', () => {
    let links = createDocsNavigationLinks()
    links.set('api', { href: '/v3', label: 'API', current: 'page' })

    assert.deepEqual(
      [...links.values()].map((link) => link.label),
      ['Guides', 'API', 'Blog', 'Jam', 'Store', 'GitHub'],
    )
    assert.deepEqual(links.get('api'), { href: '/v3', label: 'API', current: 'page' })
  })
})

describe('DocsHeader', () => {
  it('renders the Remix brand and a native mobile menu', async () => {
    let html = await renderToString(
      <DocsHeader brandLabel="Remix Docs" navigationLinks={navigationLinks} />,
    )

    assert.doesNotMatch(html, /id="docs-navigation-toggle"/)
    assert.match(html, /id="site-menu-toggle"[^>]*popovertarget="site-primary-navigation"/)
    assert.match(html, /id="site-primary-navigation"[^>]*popover="auto"/)
    assert.equal(html.match(/>Guides<\/a>/g)?.length, 2)
    assert.equal(html.match(/href="\/guides"[^>]*aria-current="location"/g)?.length, 2)
    assert.match(html, /href="https:\/\/remix\.run"[^>]*aria-label="Remix Docs"/)
    assert.equal(html.match(/id="docs-search-button"/g)?.length, 1)
    assert.doesNotMatch(html, /class="[^"]*site-header/)
    assert.doesNotMatch(html, /\[object Object\]/)
  })

  it('renders the mobile menu reveal animation', async () => {
    let html = await renderToString(
      <DocsHeader brandLabel="Remix Docs" navigationLinks={navigationLinks} />,
    )

    assert.match(html, /clip-path: inset\(0 0 100% 0\)/)
    assert.match(html, /transition-behavior: allow-discrete/)
    assert.match(html, /@starting-style/)
  })

  it('renders one responsive search trigger for Pagefind focus ownership', async () => {
    let html = await renderToString(
      <DocsHeader brandLabel="Remix Docs" navigationLinks={navigationLinks} />,
    )

    assert.doesNotMatch(html, /<button[^>]*disabled/)
    assert.doesNotMatch(html, /id="docs-search-compact"/)
    assert.doesNotMatch(html, /<pagefind-modal-trigger/)
    assert.match(html, /id="docs-search-button"[^>]*aria-label="Search"/)
    assert.match(html, /id="docs-search-button"[^>]*aria-haspopup="dialog"/)
    assert.match(html, /id="docs-search-button"[^>]*aria-expanded="false"/)
    assert.match(html, /id="docs-search-button"[^>]*aria-keyshortcuts="Meta\+K Control\+K"/)
    assert.match(html, /href="\/icons\.svg#search"/)
    assert.match(html, /<kbd>⌘<\/kbd><kbd>K<\/kbd>/)
  })

  it('renders the compact search trigger when enabled', async () => {
    let html = await renderToString(
      <DocsHeader
        brandLabel="Remix API Documentation"
        navigationLinks={navigationLinks}
        compactSearch
      />,
    )

    assert.match(html, /id="docs-search-compact"[^>]*data-docs-collapsed-only/)
    assert.match(html, /id="docs-search-button"[^>]*data-docs-expanded-only/)
  })
})
