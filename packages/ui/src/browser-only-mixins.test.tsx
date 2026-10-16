import { expect } from '@remix-run/assert'
import { describe, it } from '@remix-run/test'
import { attrs } from '@remix-run/component'
import { renderToString } from '@remix-run/component/server'
import { animateEntrance, animateExit, animateLayout } from './animation.ts'
import { onKeyDown } from './lib/keydown.ts'
import { onOutsideClick } from './lib/outside-click.ts'
import { hiddenTypeahead } from './lib/typeahead.ts'
import * as popover from './popover.ts'

describe('browser-only mixins during server rendering', () => {
  it('preserves host props alongside animation and event helpers', async () => {
    let html = await renderToString(
      <div
        id="host"
        mix={[
          animateEntrance(),
          animateExit(),
          animateLayout(),
          onKeyDown('Escape', () => {}),
          onOutsideClick(true, () => {}),
          hiddenTypeahead(() => {}),
          attrs({ title: 'server' }),
        ]}
      >
        Child content
      </div>,
    )

    expect(html).toBe('<div id="host" title="server">Child content</div>')
  })

  it('keeps popover attributes alongside browser-only focus and anchor helpers', async () => {
    let html = await renderToString(
      <popover.Context>
        <button mix={[popover.anchor({}), popover.focusOnHide()]}>Open</button>
        <div mix={[popover.surface({ open: false, onHide() {} }), popover.focusOnShow()]}>
          Content
        </div>
      </popover.Context>,
    )

    expect(html).toBe('<button>Open</button><div popover="manual">Content</div>')
  })
})
