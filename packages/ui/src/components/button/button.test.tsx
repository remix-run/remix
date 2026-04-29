// @jsxRuntime classic
// @jsx createElement
import { createElement } from '@remix-run/ui'
import { renderToString } from '@remix-run/ui/server'
import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { Glyph } from '../glyph/glyph.tsx'
import {
  Button,
  baseStyle,
  dangerStyle,
  ghostStyle,
  iconStyle,
  labelStyle,
  primaryStyle,
  secondaryStyle,
} from './button.tsx'

describe('button', () => {
  it('exposes css tokens for base, slots, and tones', () => {
    let styles = {
      baseStyle,
      dangerStyle,
      ghostStyle,
      iconStyle,
      labelStyle,
      primaryStyle,
      secondaryStyle,
    }

    expect(Object.keys(styles).sort()).toEqual([
      'baseStyle',
      'dangerStyle',
      'ghostStyle',
      'iconStyle',
      'labelStyle',
      'primaryStyle',
      'secondaryStyle',
    ])
  })

  it('lets base and tone mixins provide default button attrs while preserving explicit overrides', async () => {
    let defaultHtml = await renderToString(
      createElement('button', { mix: [baseStyle, primaryStyle] }, 'Save'),
    )
    let explicitHtml = await renderToString(
      createElement('button', { type: 'submit', mix: [baseStyle, primaryStyle] }, 'Save'),
    )
    let anchorHtml = await renderToString(
      createElement('a', { href: '/settings', mix: [baseStyle, primaryStyle] }, 'Settings'),
    )
    let composedHtml = await renderToString(
      createElement(
        'button',
        {
          mix: [baseStyle, secondaryStyle],
        },
        createElement('span', { mix: iconStyle }, 'i'),
        createElement('span', { mix: labelStyle }, 'Publish'),
      ),
    )

    expect(defaultHtml).toMatch(/type="button"/)
    expect(explicitHtml).toMatch(/type="submit"/)
    expect(anchorHtml).not.toMatch(/type="button"/)
    expect(composedHtml).toMatch(/type="button"/)
    expect(composedHtml).toMatch(/width: 1em/)
    expect(composedHtml).toMatch(/padding-inline: var\(--rmx-button-label-padding-inline\)/)
    expect(composedHtml).toMatch(/min-height: var\(--rmx-control-height-sm\)/)
    expect(composedHtml).toMatch(/font-size: var\(--rmx-font-size-xs\)/)
    expect(composedHtml).toMatch(/aria-hidden\b/)
  })

  it('renders the Button wrapper with slotted label and icons', async () => {
    let html = await renderToString(
      <Button
        aria-label="Create project"
        endIcon={<Glyph name="chevronRight" />}
        startIcon={<Glyph name="add" />}
        tone="primary"
      >
        Create
      </Button>,
    )

    expect(html).toMatch(/type="button"/)
    expect(html).toMatch(/Create/)
    expect(html).toMatch(/background-color: var\(--rmx-color-action-primary-background\)/)
    expect(html).toMatch(/padding-inline: var\(--rmx-button-label-padding-inline\)/)
    expect(html.match(/aria-hidden/g)).toHaveLength(4)
  })
})
