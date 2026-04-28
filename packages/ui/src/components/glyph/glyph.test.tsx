import { describe, expect, it } from 'vitest'

import { renderToString } from '@remix-run/ui/server'

import { glyphContract, RMX_01_GLYPHS, type GlyphName } from '../../theme/theme.ts'
import { createGlyphSheet, Glyph } from './glyph.tsx'

describe('createGlyphSheet', () => {
  it('serializes a hidden svg sprite sheet with stable symbol ids', async () => {
    let Glyphs = createGlyphSheet(RMX_01_GLYPHS.values)
    let html = await renderToString(<Glyphs />)

    expect(html).toContain('<svg')
    expect(html).toContain('aria-hidden')
    expect(html).toContain('width="0"')
    expect(html).toContain(`id="${glyphContract.add.id}"`)
    expect(html).toContain(`id="${glyphContract.spinner.id}"`)
    expect(html).toContain(`id="${glyphContract.trash.id}"`)
    expect(html).toContain('<symbol')
    expect(html).toContain('viewBox="0 0 16 16"')
  })
})

describe('Glyph', () => {
  it('renders an svg use element with the package-owned glyph id', async () => {
    let html = await renderToString(<Glyph name="trash" />)

    expect(html).toContain('<svg')
    expect(html).not.toContain('viewBox=')
    expect(html).toContain(`<use xlink:href="#${glyphContract.trash.id}"></use>`)
    expect(html).toContain('aria-hidden')
  })

  it('preserves svg host props and does not force aria-hidden when labeled', async () => {
    let html = await renderToString(
      <Glyph aria-label="Search" mix={[]} name="search" viewBox="0 0 20 20" width="24" />,
    )

    expect(html).toContain('aria-label="Search"')
    expect(html).toContain('viewBox="0 0 20 20"')
    expect(html).toContain('width="24"')
    expect(html).not.toContain('aria-hidden')
  })

  it('keeps glyph names typed', () => {
    let name: GlyphName = 'copy'

    expect(name).toBe('copy')

    // @ts-expect-error unknown glyph names should be rejected
    let invalidName: GlyphName = 'unknown'

    expect(invalidName).toBe('unknown')
  })
})
