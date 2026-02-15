/** @jsxImportSource @remix-run/reconciler/testing */

import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createReconciler, definePlugin } from '../index.ts'
import { jsx } from '../testing/jsx-runtime.ts'
import { createTestContainer, createTestNodePolicy, stringifyTestNode } from './test-node-policy.ts'
import type { Plugin, ReconcilerErrorEvent } from './types.ts'

describe('reconciler package', () => {
  it('renders, updates, and removes host content', () => {
    let nodePolicy = createTestNodePolicy()
    let container = createTestContainer()
    let reconciler = createReconciler([attributeProps()], { nodePolicy })
    let root = reconciler.createRoot(container)

    root.render(<div id="first">hello</div>)
    root.flush()
    assert.equal(stringifyTestNode(container), '<div id="first">hello</div>')

    root.render(<div id="second">world</div>)
    root.flush()
    assert.equal(stringifyTestNode(container), '<div id="second">world</div>')

    root.render(null)
    root.flush()
    assert.equal(stringifyTestNode(container), '')
  })

  it('reorders keyed children using policy moves', () => {
    let nodePolicy = createTestNodePolicy()
    let container = createTestContainer()
    let reconciler = createReconciler([attributeProps()], { nodePolicy })
    let root = reconciler.createRoot(container)

    root.render(
      <ul>
        <li key="a">A</li>
        <li key="b">B</li>
        <li key="c">C</li>
      </ul>,
    )
    root.flush()
    assert.equal(stringifyTestNode(container), '<ul><li>A</li><li>B</li><li>C</li></ul>')
    let initialMoves = nodePolicy.operations.move

    root.render(
      <ul>
        <li key="c">C</li>
        <li key="a">A</li>
        <li key="b">B</li>
      </ul>,
    )
    root.flush()
    assert.equal(stringifyTestNode(container), '<ul><li>C</li><li>A</li><li>B</li></ul>')
    assert.ok(nodePolicy.operations.move > initialMoves)
  })

  it('applies plugin transforms in declaration order', () => {
    let nodePolicy = createTestNodePolicy()
    let container = createTestContainer()
    let events: string[] = []
    let pluginA = definePlugin(() => () => (input) => {
      events.push('a')
      return {
        ...input,
        props: { ...input.props, a: '1' },
      }
    })
    let pluginB = definePlugin(() => () => (input) => {
      events.push('b')
      let next = { ...input.props, b: String(input.props.a ?? '') + '2' }
      return { ...input, props: next }
    })
    let reconciler = createReconciler([pluginA, pluginB, attributeProps()], { nodePolicy })
    let root = reconciler.createRoot(container)

    root.render(<div />)
    root.flush()

    assert.equal(stringifyTestNode(container), '<div a="1" b="12"></div>')
    assert.deepEqual(events, ['a', 'b'])
  })

  it('dispatches root errors for scheduler and reconcile failures', async () => {
    let nodePolicy = createTestNodePolicy()
    let container = createTestContainer()
    let events: ReconcilerErrorEvent[] = []

    let throwsBeforeFlush = definePlugin((pluginHandle) => {
      pluginHandle.addEventListener('beforeFlush', () => {
        throw new Error('before-flush')
      })
      return undefined
    })

    let invalidHostType = definePlugin(() => () => (_input) => {
      let next = {
        type: 123,
        props: {},
      }
      return next
    })

    let reconciler = createReconciler([throwsBeforeFlush, invalidHostType, attributeProps()], {
      nodePolicy,
    })
    let root = reconciler.createRoot(container)
    root.addEventListener('error', (event) => {
      events.push(event as ReconcilerErrorEvent)
    })

    root.render((handle) => <div>hello</div>)
    root.flush()
    await Promise.resolve()

    let phases = events.map((event) => event.context.phase)
    assert.ok(phases.includes('beforeFlush'))
    assert.ok(phases.includes('reconcile'))
  })

  it('dispatches root errors for root and host task failures', async () => {
    let nodePolicy = createTestNodePolicy()
    let container = createTestContainer()
    let events: ReconcilerErrorEvent[] = []

    let throwsHostTask = definePlugin(() => (host) => (input) => {
      host.queueTask(() => {
        throw new Error('host-task')
      })
      return input
    })

    let reconciler = createReconciler([throwsHostTask, attributeProps()], { nodePolicy })
    let root = reconciler.createRoot(container)
    root.addEventListener('error', (event) => {
      events.push(event as ReconcilerErrorEvent)
    })

    root.render((handle) => {
      handle.queueTask(() => {
        throw new Error('root-task')
      })
      return <div>hello</div>
    })
    root.flush()
    await Promise.resolve()

    let phases = events.map((event) => event.context.phase)
    assert.ok(phases.includes('hostTask'))
    assert.ok(phases.includes('rootTask'))
  })

  it('supports JSX fragments and nested arrays', () => {
    let nodePolicy = createTestNodePolicy()
    let container = createTestContainer()
    let reconciler = createReconciler([attributeProps()], { nodePolicy })
    let root = reconciler.createRoot(container)

    let items = ['x', 'y']
    root.render(
      <>
        <section id="first">top</section>
        <>
          {items.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </>
      </>,
    )
    root.flush()

    assert.equal(
      stringifyTestNode(container),
      '<section id="first">top</section><span>x</span><span>y</span>',
    )
  })

  it('preserves keys in testing JSX runtime output', () => {
    let keyed = jsx('span', { children: 'value' }, 'item-key')
    assert.equal(keyed.key, 'item-key')
  })
})

function attributeProps<
  elementNode extends { attributes: Record<string, string> },
>(): Plugin<elementNode> {
  return definePlugin(() => (host) => {
    let current = new Set<string>()
    return (input) => {
      let next = new Map<string, string>()
      for (let key in input.props) {
        if (key === 'children') continue
        let value = input.props[key]
        if (value == null || value === false) continue
        if (typeof value === 'object' || typeof value === 'function') continue
        next.set(key, String(value))
      }
      host.queueTask((node) => {
        for (let key of current) {
          if (next.has(key)) continue
          delete node.attributes[key]
        }
        for (let [key, value] of next) {
          node.attributes[key] = value
        }
        current = new Set(next.keys())
      })
      return input
    }
  })
}
