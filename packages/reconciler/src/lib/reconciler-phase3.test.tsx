import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createTestNodeReconciler } from '../testing/test-node-reconciler.ts'
import type { Component } from '../testing/jsx-runtime.ts'

describe('reconciler phase 3 validation', () => {
  it('reconciles complex mixed host/component trees with children composition', () => {
    let Wrap: Component<undefined, { title: string; children?: unknown }> = () => (props) => (
      <panel>
        <title>{props.title}</title>
        <content>{props.children}</content>
      </panel>
    )
    let Leaf: Component<undefined, { label: string }> = () => (props) => <leaf>{props.label}</leaf>
    let reconciler = createTestNodeReconciler()
    let root = reconciler.createRoot()

    root.render(
      <root>
        <Wrap title="A">
          <Leaf label="x" />
          <item>one</item>
        </Wrap>
        <tail>end</tail>
      </root>,
    )
    root.flush()

    assert.equal(
      root.inspect(),
      '<root><panel><title>A</title><content><leaf>x</leaf><item>one</item></content></panel><tail>end</tail></root>',
    )
  })

  it('updates component state via captured handle.update', () => {
    let capturedUpdate = () => {}
    let Counter: Component<undefined, {}> = (handle) => {
      let count = 0
      capturedUpdate = () => {
        count++
        handle.update()
      }
      return () => <value>{String(count)}</value>
    }

    let reconciler = createTestNodeReconciler()
    let root = reconciler.createRoot()
    root.render(<Counter />)
    root.flush()
    assert.equal(root.inspect(), '<value>0</value>')

    capturedUpdate()
    root.flush()
    assert.equal(root.inspect(), '<value>1</value>')
  })

  it('replaces host nodes when type changes', () => {
    let reconciler = createTestNodeReconciler()
    let root = reconciler.createRoot()
    root.render(<a />)
    root.flush()
    assert.equal(root.inspect(), '<a></a>')

    root.render(<b />)
    root.flush()
    assert.equal(root.inspect(), '<b></b>')
  })

  it('moves keyed nodes in new order', () => {
    let reconciler = createTestNodeReconciler()
    let root = reconciler.createRoot()
    root.render(
      <list>
        <a key="a">A</a>
        <b key="b">B</b>
        <c key="c">C</c>
      </list>,
    )
    root.flush()
    root.render(
      <list>
        <c key="c">C</c>
        <a key="a">A</a>
        <b key="b">B</b>
      </list>,
    )
    root.flush()
    assert.equal(root.inspect(), '<list><c>C</c><a>A</a><b>B</b></list>')
  })

  it('moves unkeyed nodes by compatibility matching', () => {
    let reconciler = createTestNodeReconciler()
    let root = reconciler.createRoot()
    root.render(
      <list>
        <a>A</a>
        <b>B</b>
      </list>,
    )
    root.flush()
    root.render(
      <list>
        <b>B</b>
        <a>A</a>
      </list>,
    )
    root.flush()
    assert.equal(root.inspect(), '<list><b>B</b><a>A</a></list>')
  })

  it('replaces keyed nodes when key is same but type changes', () => {
    let reconciler = createTestNodeReconciler()
    let root = reconciler.createRoot()
    root.render(
      <list>
        <a key="same">A</a>
      </list>,
    )
    root.flush()
    root.render(
      <list>
        <b key="same">B</b>
      </list>,
    )
    root.flush()
    assert.equal(root.inspect(), '<list><b>B</b></list>')
  })

  it('inserts new nodes at interior positions', () => {
    let reconciler = createTestNodeReconciler()
    let root = reconciler.createRoot()
    root.render(
      <list>
        <a>A</a>
        <c>C</c>
      </list>,
    )
    root.flush()
    root.render(
      <list>
        <a>A</a>
        <b>B</b>
        <c>C</c>
      </list>,
    )
    root.flush()
    assert.equal(root.inspect(), '<list><a>A</a><b>B</b><c>C</c></list>')
  })

  it('enforces illegal operations in test node policy', () => {
    let reconciler = createTestNodeReconciler()
    let root = reconciler.createRoot()
    root.render(<a />)
    root.flush()
    let policy = reconciler.policy
    let container = root.container
    let node = container.children[0]
    assert.ok(node)
    assert.throws(() => {
      policy.remove(container, node as never)
      policy.remove(container, node as never)
    })
  })
})
