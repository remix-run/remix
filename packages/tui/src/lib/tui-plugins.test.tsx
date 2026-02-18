import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createTuiContainer } from './tui-node-policy.ts'
import { createTuiReconciler } from './tui-reconciler.ts'
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

describe('tui plugins', () => {
  it('applies and clears special plugin props across updates', () => {
    let { container, root } = createTestTuiRoot()

    root.render(
      <box
        style={{ color: 'green' }}
        layout={{ direction: 'column' }}
        on={{ keypress: () => {} }}
        id="a"
      />,
    )
    root.flush()

    let host = container.children[0]
    assert.equal(host?.kind, 'element')
    if (!host || host.kind !== 'element') return
    assert.equal(host.host.props['style.color'], 'green')
    assert.equal(host.host.props['layout.direction'], 'column')
    assert.equal(typeof host.host.props['on.keypress'], 'function')
    assert.equal(host.host.props.id, 'a')

    root.render(<box id="b" />)
    root.flush()

    assert.equal(host.host.props['style.color'], undefined)
    assert.equal(host.host.props['layout.direction'], undefined)
    assert.equal(host.host.props['on.keypress'], undefined)
    assert.equal(host.host.props.id, 'b')
  })
})
