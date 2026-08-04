import input from '@remix-run/ui/input'
import { renderToString } from '@remix-run/ui/server'
import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

describe('input', () => {
  it('exports the default input mixin with medium styling', async () => {
    let html = await renderToString(<input mix={input()} placeholder="Limit" />)

    expect(html).toMatch(/height: 32px/)
    expect(html).toMatch(/padding-block: var\(--rmx-input-padding-block\)/)
    expect(html).toMatch(/padding-inline: var\(--rmx-input-padding-inline\)/)
    expect(html).toMatch(/border-radius: 8px/)
    expect(html).toMatch(/background: light-dark\(#FFFFFF, #1a1a1a\)/)
    expect(html).toMatch(/font-weight: 400/)
    expect(html).toMatch(/font-size: 13px/)
    expect(html).toMatch(/line-height: 20px/)
    expect(html).toMatch(/color: light-dark\(#B0B0B0, #777777\)/)
  })

  it('supports large raw input styling', async () => {
    let html = await renderToString(<input mix={input({ size: 'lg' })} />)

    expect(html).toMatch(/--rmx-input-height: 36px/)
    expect(html).toMatch(/--rmx-input-padding-block: 8px/)
    expect(html).toMatch(/--rmx-input-padding-inline: 14px/)
  })

  it('styles root and field composition for icon inputs', async () => {
    let html = await renderToString(
      <div mix={input.root()}>
        <svg />
        <input mix={input.field()} placeholder="Search and filter products" />
      </div>,
    )

    expect(html).toMatch(/display: flex/)
    expect(html).toMatch(/padding-inline: var\(--rmx-input-root-padding-inline\)/)
    expect(html).toMatch(/gap: var\(--rmx-input-gap\)/)
    expect(html).toMatch(/& > svg/)
    expect(html).toMatch(/width: var\(--rmx-input-icon-size\)/)
    expect(html).toMatch(/flex: 1 1 auto/)
    expect(html).toMatch(/background: transparent/)
    expect(html).toMatch(/box-shadow: none/)
  })

  it('includes focus and disabled states without transitions', async () => {
    let html = await renderToString(
      <>
        <input disabled mix={input()} />
        <div mix={input.root()}>
          <input disabled mix={input.field()} />
        </div>
      </>,
    )

    expect(html).toMatch(/:focus-visible/)
    expect(html).toMatch(/:focus-within/)
    expect(html).toMatch(/0 0 0 1px light-dark\(#3573F6, #6eaaff\)/)
    expect(html).toMatch(/&:disabled, &\[aria-disabled="true"\]/)
    expect(html).toMatch(/:has\(input:disabled\)/)
    expect(html).toMatch(/opacity: 0\.55/)
    expect(html).not.toMatch(/cursor:/)
    expect(html).not.toMatch(/transition/)
    expect(html).not.toMatch(/all: unset/)
  })
})
