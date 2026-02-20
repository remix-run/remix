import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createTestNodeReconciler } from '../testing/test-node-reconciler.ts'
import type { Component } from '../testing/jsx-runtime.ts'
import { definePlugin } from './types.ts'

describe('incremental reconciler validation', () => {
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

  it('propagates local component updates through stable ancestors', () => {
    let updateLeaf = () => {}
    let Leaf: Component<undefined, {}> = (handle) => {
      let count = 0
      updateLeaf = () => {
        count++
        handle.update()
      }
      return () => <leaf>{String(count)}</leaf>
    }
    let Wrapper: Component<undefined, { children?: unknown }> = () => (props) => (
      <wrapper>{props.children}</wrapper>
    )
    let reconciler = createTestNodeReconciler()
    let root = reconciler.createRoot()
    root.render(
      <Wrapper>
        <Leaf />
      </Wrapper>,
    )
    root.flush()
    assert.equal(root.inspect(), '<wrapper><leaf>0</leaf></wrapper>')

    updateLeaf()
    root.flush()
    assert.equal(root.inspect(), '<wrapper><leaf>1</leaf></wrapper>')
  })

  it('bails out component subtree when props are shallow-equal and no local update is pending', () => {
    let renders = 0
    let Child: Component<undefined, { label: string }> = () => (props) => {
      renders++
      return <leaf>{props.label}</leaf>
    }
    let reconciler = createTestNodeReconciler()
    let root = reconciler.createRoot()

    root.render(
      <wrap>
        <Child label="same" />
      </wrap>,
    )
    root.flush()
    assert.equal(renders, 1)

    root.render(
      <wrap>
        <Child label="same" />
      </wrap>,
    )
    root.flush()
    assert.equal(renders, 1)
  })

  it('runs routed plugins only when dependencies change', () => {
    let pluginApplies = 0
    let routedPlugin = definePlugin({
      phase: 'special' as const,
      keys: ['data-x'],
      shouldActivate(context) {
        return typeof context.delta.nextProps['data-x'] === 'string'
      },
      apply() {
        pluginApplies++
      },
    })
    let reconciler = createTestNodeReconciler([routedPlugin])
    let root = reconciler.createRoot()

    root.render(<item id="a" data-x="one" />)
    root.flush()
    assert.equal(pluginApplies, 1)

    root.render(<item id="a" data-x="one" />)
    root.flush()
    assert.equal(pluginApplies, 1)

    root.render(<item id="a" data-x="two" />)
    root.flush()
    assert.equal(pluginApplies, 2)
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
