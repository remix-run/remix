import { describe, expect, it } from 'vitest'

import { renderToString } from '@remix-run/ui/server'

import { Breadcrumbs } from './breadcrumbs.tsx'

describe('Breadcrumbs', () => {
  it('renders semantic breadcrumb structure', async () => {
    let html = await renderToString(
      <Breadcrumbs
        items={[
          { href: '/', label: 'Home' },
          { href: '/components', label: 'Components' },
          { label: 'Breadcrumbs' },
        ]}
      />,
    )

    expect(html).toContain('<nav aria-label="Breadcrumb"')
    expect(html).toContain('<ol')
    expect(html).toContain('<li')
  })

  it('renders the default chevron separator', async () => {
    let html = await renderToString(
      <Breadcrumbs items={[{ href: '/', label: 'Home' }, { label: 'Breadcrumbs' }]} />,
    )

    expect(html).toContain('rmx-glyph-chevronRight')
  })

  it('renders a custom separator', async () => {
    let html = await renderToString(
      <Breadcrumbs
        items={[{ href: '/', label: 'Home' }, { label: 'Breadcrumbs' }]}
        separator="/"
      />,
    )

    expect(html).toContain('>/</li>')
  })

  it('defaults the last item to current', async () => {
    let html = await renderToString(
      <Breadcrumbs items={[{ href: '/', label: 'Home' }, { label: 'Breadcrumbs' }]} />,
    )

    expect(html).toContain('aria-current="page"')
    expect(html).not.toContain('href="Breadcrumbs"')
  })

  it('prefers an explicit current item', async () => {
    let html = await renderToString(
      <Breadcrumbs
        items={[
          { href: '/', label: 'Home' },
          { current: true, href: '/components', label: 'Components' },
          { label: 'Breadcrumbs' },
        ]}
      />,
    )

    expect(html).toContain('>Components</span>')
    expect(html).toContain('aria-current="page"')
  })

  it('renders non-current href items as links and non-link items as text', async () => {
    let html = await renderToString(
      <Breadcrumbs
        items={[{ href: '/', label: 'Home' }, { label: 'Components' }, { label: 'Breadcrumbs' }]}
      />,
    )

    expect(html).toContain('<a href="/"')
    expect(html).toContain('>Components</span>')
  })

  it('keeps the current item as text even when href is provided', async () => {
    let html = await renderToString(
      <Breadcrumbs
        items={[
          { href: '/', label: 'Home' },
          { href: '/components', label: 'Components' },
        ]}
      />,
    )

    expect(html).toContain('aria-current="page"')
    expect(html).toContain('>Components</span>')
    expect(html).not.toContain('<a href="/components"')
  })
})
