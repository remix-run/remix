import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { stringifyTuiTree } from './tui-inspect.ts'
import { createTuiReconciler } from './tui-reconciler.ts'
import { createTuiContainer } from './tui-node-policy.ts'
import { createTestHostBridge } from '../testing/test-host-bridge.ts'

function createTestTuiRoot() {
  let bridge = createTestHostBridge()
  let container = createTuiContainer({ type: 'test-root' }, bridge)
  let reconciler = createTuiReconciler()
  return {
    container,
    root: reconciler.createRoot(container),
  }
}

describe('tui reconciler', () => {
  it('reconciles mixed host trees and text updates', () => {
    let { container, root } = createTestTuiRoot()

    root.render(
      <box>
        <row>
          <label>Hello</label>
        </row>
      </box>,
    )
    root.flush()
    assert.equal(stringifyTuiTree(container), '<box><row><label>Hello</label></row></box>')

    root.render(
      <box>
        <row>
          <label>World</label>
        </row>
      </box>,
    )
    root.flush()
    assert.equal(stringifyTuiTree(container), '<box><row><label>World</label></row></box>')
  })

  it('applies style/layout/on via plugins and leaves basic props to terminal plugin', () => {
    let { container, root } = createTestTuiRoot()
    let clicked = 0
    let on = { keypress: () => clicked++ }

    root.render(
      <box
        foo="bar"
        style={{ color: 'green', bold: true }}
        layout={{ direction: 'column', gap: 1 }}
        on={on}
      >
        hi
      </box>,
    )
    root.flush()

    let host = container.children[0]
    assert.equal(host?.kind, 'element')
    if (!host || host.kind !== 'element') return

    assert.equal(host.host.props.foo, 'bar')
    assert.equal(host.host.props['style.color'], 'green')
    assert.equal(host.host.props['style.bold'], true)
    assert.equal(host.host.props['layout.direction'], 'column')
    assert.equal(host.host.props['layout.gap'], 1)
    assert.equal(host.host.props['on.keypress'], on.keypress)
    assert.equal(host.host.props.style, undefined)
    assert.equal(host.host.props.layout, undefined)
    assert.equal(host.host.props.on, undefined)
    assert.equal(clicked, 0)
  })
})
