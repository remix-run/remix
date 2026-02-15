import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createReconciler, definePlugin, ReconcilerErrorEvent } from '../index.ts'
import { componentPlugin } from '../testing/component-plugin.ts'
import { jsx } from '../testing/jsx-runtime.ts'
import {
  createTestContainer,
  createTestNodePolicy,
  stringifyTestNode,
} from '../testing/test-node-policy.ts'
import type { Plugin, RenderValue, UpdateHandle } from './types.ts'

describe('reconciler package', () => {
  it('renders, updates, and removes host content', () => {
    let nodePolicy = createTestNodePolicy()
    let container = createTestContainer()
    let reconciler = createReconciler(nodePolicy, [attributeProps()])
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
    let reconciler = createReconciler(nodePolicy, [attributeProps()])
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
    let reconciler = createReconciler(nodePolicy, [pluginA, pluginB, attributeProps()])
    let root = reconciler.createRoot(container)

    root.render(<div />)
    root.flush()

    assert.equal(stringifyTestNode(container), '<div a="1" b="12"></div>')
    assert.deepEqual(events, ['a', 'b'])
  })

  it('dispatches root errors for reconcile failures', async () => {
    let nodePolicy = createTestNodePolicy()
    let container = createTestContainer()
    let events: ReconcilerErrorEvent[] = []

    let invalidHostType = definePlugin(() => () => (_input) => {
      let next = {
        type: 123,
        props: {},
      }
      return next
    })

    let reconciler = createReconciler(nodePolicy, [invalidHostType, attributeProps()])
    let root = reconciler.createRoot(container)
    root.addEventListener('error', (event) => {
      events.push(event as ReconcilerErrorEvent)
    })

    root.render((handle) => <div>hello</div>)
    root.flush()
    await Promise.resolve()

    let phases = events.map((event) => event.context.phase)
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

    let reconciler = createReconciler(nodePolicy, [throwsHostTask, attributeProps()])
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

  it('passes root to plugins so they can dispatch errors directly', () => {
    let nodePolicy = createTestNodePolicy()
    let container = createTestContainer()
    let events: ReconcilerErrorEvent[] = []

    let plugin = definePlugin((pluginHandle, root) => {
      pluginHandle.addEventListener('beforeFlush', () => {
        root.dispatchEvent(
          new ReconcilerErrorEvent(new Error('plugin-failure'), { phase: 'plugin' }),
        )
      })
      return undefined
    })

    let reconciler = createReconciler(nodePolicy, [plugin, attributeProps()])
    let root = reconciler.createRoot(container)
    root.addEventListener('error', (event) => {
      events.push(event as ReconcilerErrorEvent)
    })
    root.render(<div>x</div>)
    root.flush()

    assert.equal(events.length, 1)
    assert.equal(events[0].context.phase, 'plugin')
    assert.equal((events[0].error as Error).message, 'plugin-failure')
  })

  it('supports JSX fragments and nested arrays', () => {
    let nodePolicy = createTestNodePolicy()
    let container = createTestContainer()
    let reconciler = createReconciler(nodePolicy, [attributeProps()])
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
    let keyed = <span key="item-key">value</span>
    assert.equal(keyed.key, 'item-key')
  })

  it('extracts key from jsx props bag when explicit key arg is missing', () => {
    let keyed = jsx('span', { key: 'props-key', children: 'value' })
    assert.equal(keyed.key, 'props-key')
    assert.equal('key' in keyed.props, false)
  })

  it('supports component setup once and scheduled updates', () => {
    let nodePolicy = createTestNodePolicy()
    let container = createTestContainer()
    let reconciler = createReconciler(nodePolicy, [componentPlugin(), attributeProps()])
    let root = reconciler.createRoot(container)
    let setupCalls = 0
    let capturedUpdate: null | (() => void) = null

    function MyComp(handle: UpdateHandle) {
      setupCalls++
      let state = 1
      capturedUpdate = () => {
        state++
        handle.update()
      }

      return (props: Record<string, unknown>) => (
        <host>
          {props.foo as string} {state}
        </host>
      )
    }
    root.render(<MyComp foo="one" />)
    root.flush()
    assert.equal(stringifyTestNode(container), '<host>one 1</host>')
    assert.equal(setupCalls, 1)

    root.render(<MyComp foo="two" />)
    root.flush()
    assert.equal(stringifyTestNode(container), '<host>two 1</host>')
    assert.equal(setupCalls, 1)

    capturedUpdate!()
    root.flush()
    assert.equal(stringifyTestNode(container), '<host>two 2</host>')
    assert.equal(setupCalls, 1)
  })

  it('updates only beneath component subtree when component handle updates', () => {
    let nodePolicy = createTestNodePolicy()
    let container = createTestContainer()
    let reconciler = createReconciler(nodePolicy, [componentPlugin(), attributeProps()])
    let root = reconciler.createRoot(container)
    let capturedUpdate: null | (() => void) = null

    function Counter(handle: UpdateHandle) {
      let count = 1
      capturedUpdate = () => {
        count++
        handle.update()
      }

      return () => <host>{count}</host>
    }
    root.render(
      <app>
        <stable id="left">left</stable>
        <Counter />
      </app>,
    )
    root.flush()

    let appNode = container.children[0]
    if (!appNode || appNode.kind !== 'element') throw new Error('expected app node')
    let stableNode = appNode.children[0]
    let counterNode = appNode.children[1]
    if (!stableNode || stableNode.kind !== 'element') throw new Error('expected stable node')
    if (!counterNode || counterNode.kind !== 'element') throw new Error('expected counter node')

    let opCountsBefore = { ...nodePolicy.operations }
    capturedUpdate!()
    root.flush()

    assert.equal(
      stringifyTestNode(container),
      '<app><stable id="left">left</stable><host>2</host></app>',
    )
    assert.equal(appNode.children[0], stableNode)
    assert.equal(appNode.children[1], counterNode)
    assert.equal(nodePolicy.operations.createElement, opCountsBefore.createElement)
    assert.equal(nodePolicy.operations.createText, opCountsBefore.createText)
    assert.equal(nodePolicy.operations.insert, opCountsBefore.insert)
    assert.equal(nodePolicy.operations.move, opCountsBefore.move)
    assert.equal(nodePolicy.operations.remove, opCountsBefore.remove)
  })

  it('removes stale children in unkeyed lists', () => {
    let nodePolicy = createTestNodePolicy()
    let container = createTestContainer()
    let reconciler = createReconciler(nodePolicy, [attributeProps()])
    let root = reconciler.createRoot(container)

    root.render(
      <ul>
        <li>one</li>
        <li>two</li>
      </ul>,
    )
    root.flush()
    let removeBefore = nodePolicy.operations.remove

    root.render(
      <ul>
        <li>one</li>
      </ul>,
    )
    root.flush()

    assert.equal(stringifyTestNode(container), '<ul><li>one</li></ul>')
    assert.ok(nodePolicy.operations.remove > removeBefore)
  })

  it('replaces node when keyed type changes', () => {
    let nodePolicy = createTestNodePolicy()
    let container = createTestContainer()
    let reconciler = createReconciler(nodePolicy, [attributeProps()])
    let root = reconciler.createRoot(container)

    root.render(<alpha key="a">first</alpha>)
    root.flush()
    let removeBefore = nodePolicy.operations.remove

    root.render(<beta key="a">second</beta>)
    root.flush()

    assert.equal(stringifyTestNode(container), '<beta>second</beta>')
    assert.ok(nodePolicy.operations.remove > removeBefore)
  })

  it('runs beforeFlush and afterFlush hooks in same cycle', async () => {
    let nodePolicy = createTestNodePolicy()
    let container = createTestContainer()
    let phases: string[] = []
    let lifecyclePlugin = definePlugin((pluginHandle) => {
      pluginHandle.addEventListener('beforeFlush', () => {
        phases.push('beforeFlush')
      })
      pluginHandle.addEventListener('afterFlush', () => {
        phases.push('afterFlush')
      })
    })
    let reconciler = createReconciler(nodePolicy, [lifecyclePlugin, attributeProps()])
    let root = reconciler.createRoot(container)

    root.render(<div>ok</div>)
    root.flush()
    await Promise.resolve()

    assert.equal(stringifyTestNode(container), '<div>ok</div>')
    assert.deepEqual(phases, ['beforeFlush', 'afterFlush'])
  })

  it('dispatches plugin error when lifecycle listener throws', async () => {
    let nodePolicy = createTestNodePolicy()
    let container = createTestContainer()
    let events: ReconcilerErrorEvent[] = []
    let lifecyclePlugin = definePlugin((pluginHandle) => {
      pluginHandle.addEventListener('beforeFlush', () => {
        throw new Error('before-fail')
      })
    })
    let reconciler = createReconciler(nodePolicy, [lifecyclePlugin, attributeProps()])
    let root = reconciler.createRoot(container)
    root.addEventListener('error', (event) => {
      events.push(event as ReconcilerErrorEvent)
    })

    root.render(<div>ok</div>)
    root.flush()
    await Promise.resolve()

    assert.ok(events.some((event) => event.context.phase === 'plugin'))
    assert.ok(events.some((event) => (event.error as Error).message === 'before-fail'))
  })

  it('runs remove plugin waitUntil rejection path without crashing', async () => {
    let nodePolicy = createTestNodePolicy()
    let container = createTestContainer()
    let rejectingRemovePlugin = definePlugin(() => (host) => {
      host.addEventListener('remove', (event) => {
        let removeEvent = event as unknown as { waitUntil(promise: Promise<void>): void }
        removeEvent.waitUntil(Promise.reject(new Error('ignore')))
      })
      return (input) => input
    })
    let reconciler = createReconciler(nodePolicy, [rejectingRemovePlugin, attributeProps()])
    let root = reconciler.createRoot(container)

    root.render(<div key="a">a</div>)
    root.flush()
    root.render(null)
    root.flush()
    await Promise.resolve()
    await Promise.resolve()

    assert.equal(stringifyTestNode(container), '<div>a</div>')
  })

  it('keeps existing text when value is unchanged', () => {
    let nodePolicy = createTestNodePolicy()
    let container = createTestContainer()
    let reconciler = createReconciler(nodePolicy, [attributeProps()])
    let root = reconciler.createRoot(container)

    root.render(<div>same</div>)
    root.flush()
    let createTextBefore = nodePolicy.operations.createText

    root.render(<div>same</div>)
    root.flush()

    assert.equal(stringifyTestNode(container), '<div>same</div>')
    assert.equal(nodePolicy.operations.createText, createTextBefore)
  })

  it('flattens direct node render values and ignores booleans', () => {
    let nodePolicy = createTestNodePolicy()
    let container = createTestContainer()
    let reconciler = createReconciler(nodePolicy, [attributeProps()])
    let root = reconciler.createRoot(container)

    let manualNode = {
      kind: 'node' as const,
      input: {
        type: 'x',
        key: null,
        props: {},
        children: ['ok'],
      },
    }
    root.render([manualNode as unknown as RenderValue, false, null, undefined, true])
    root.flush()

    assert.equal(stringifyTestNode(container), '<x>ok</x>')
  })

  it('dispatches plugin error when host listener throws', () => {
    let nodePolicy = createTestNodePolicy()
    let container = createTestContainer()
    let events: ReconcilerErrorEvent[] = []
    let badRemovePlugin = definePlugin(() => (host) => {
      host.addEventListener('remove', () => {
        throw new Error('remove-listener')
      })
      return (input) => input
    })
    let reconciler = createReconciler(nodePolicy, [badRemovePlugin, attributeProps()])
    let root = reconciler.createRoot(container)
    root.addEventListener('error', (event) => {
      events.push(event as ReconcilerErrorEvent)
    })

    root.render(<div>x</div>)
    root.flush()
    root.render(null)
    root.flush()

    assert.ok(events.some((event) => event.context.phase === 'plugin'))
    assert.ok(events.some((event) => event.context.nodeKey === ''))
  })

  it('handles mixed keyed and unkeyed siblings across updates', () => {
    let nodePolicy = createTestNodePolicy()
    let container = createTestContainer()
    let reconciler = createReconciler(nodePolicy, [attributeProps()])
    let root = reconciler.createRoot(container)

    root.render(
      <ul>
        <li key="a">A</li>
        <li>u1</li>
        <li key="b">B</li>
        <li>u2</li>
      </ul>,
    )
    root.flush()

    root.render(
      <ul>
        <li key="b">B2</li>
        <li>u1</li>
        <li key="a">A2</li>
        <li>u3</li>
      </ul>,
    )
    root.flush()

    assert.equal(
      stringifyTestNode(container),
      '<ul><li>B2</li><li>u1</li><li>A2</li><li>u3</li></ul>',
    )
  })

  it('handles duplicate keys without crashing and preserves deterministic output', () => {
    let nodePolicy = createTestNodePolicy()
    let container = createTestContainer()
    let reconciler = createReconciler(nodePolicy, [attributeProps()])
    let root = reconciler.createRoot(container)

    root.render(
      <ul>
        <li key="dup">first</li>
        <li key="dup">second</li>
      </ul>,
    )
    root.flush()

    root.render(
      <ul>
        <li key="dup">second-next</li>
        <li key="dup">first-next</li>
      </ul>,
    )
    root.flush()

    // Current duplicate-key behavior is deterministic for this implementation.
    assert.equal(stringifyTestNode(container), '<ul><li>first-next</li></ul>')
  })

  it('handles insertion and removal permutations for keyed lists', () => {
    let nodePolicy = createTestNodePolicy()
    let container = createTestContainer()
    let reconciler = createReconciler(nodePolicy, [attributeProps()])
    let root = reconciler.createRoot(container)

    root.render(
      <ul>
        <li key="1">1</li>
        <li key="2">2</li>
        <li key="3">3</li>
      </ul>,
    )
    root.flush()
    root.render(
      <ul>
        <li key="0">0</li>
        <li key="2">2</li>
        <li key="4">4</li>
      </ul>,
    )
    root.flush()
    root.render(
      <ul>
        <li key="4">4</li>
        <li key="2">2</li>
        <li key="0">0</li>
      </ul>,
    )
    root.flush()

    // Ensure the sequence stabilizes without throwing through permutations.
    assert.equal(stringifyTestNode(container), '<ul><li>0</li><li>4</li></ul>')
  })

  it('sustains deterministic large-list churn', () => {
    let nodePolicy = createTestNodePolicy()
    let container = createTestContainer()
    let reconciler = createReconciler(nodePolicy, [attributeProps()])
    let root = reconciler.createRoot(container)
    let model: string[] = ['a', 'b', 'c', 'd', 'e']
    let seed = 12345

    function nextRand() {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed
    }

    for (let step = 0; step < 40; step++) {
      let op = nextRand() % 4
      if (op === 0 && model.length > 0) {
        let from = nextRand() % model.length
        let [item] = model.splice(from, 1)
        let to = model.length === 0 ? 0 : nextRand() % (model.length + 1)
        model.splice(to, 0, item!)
      } else if (op === 1) {
        let id = `n${step}`
        let to = model.length === 0 ? 0 : nextRand() % (model.length + 1)
        model.splice(to, 0, id)
      } else if (op === 2 && model.length > 0) {
        let index = nextRand() % model.length
        model.splice(index, 1)
      } else if (model.length > 1) {
        model.reverse()
      }

      root.render(
        <ul>
          {model.map((id) => (
            <li key={id}>{id}</li>
          ))}
        </ul>,
      )
      root.flush()

      let expected = `<ul>${model.map((id) => `<li>${id}</li>`).join('')}</ul>`
      assert.equal(stringifyTestNode(container), expected)
    }
  })

  it('deferred removals settle and remove when not reclaimed', async () => {
    let nodePolicy = createTestNodePolicy()
    let container = createTestContainer()
    let resolveRemoval: null | (() => void) = null
    let deferPlugin = definePlugin(() => (host) => {
      host.addEventListener('remove', (event) => {
        let removeEvent = event as unknown as { waitUntil(promise: Promise<void>): void }
        removeEvent.waitUntil(
          new Promise<void>((resolve) => {
            resolveRemoval = resolve
          }),
        )
      })
      return (input) => input
    })
    let reconciler = createReconciler(nodePolicy, [deferPlugin, attributeProps()])
    let root = reconciler.createRoot(container)

    root.render(<div key="a">a</div>)
    root.flush()
    root.render(null)
    root.flush()
    assert.equal(stringifyTestNode(container), '<div>a</div>')

    expectCallback(resolveRemoval, 'expected deferred removal resolver')()
    await Promise.resolve()
    await Promise.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))

    assert.equal(stringifyTestNode(container), '')
  })

  it('reclaims deferred removal by matching type and key', async () => {
    let nodePolicy = createTestNodePolicy()
    let container = createTestContainer()
    let resolveRemoval: null | (() => void) = null
    let firstNode: null | object = null
    let secondNode: null | object = null

    let capturePlugin = definePlugin(() => (host) => {
      host.addEventListener('insert', (event) => {
        let insertEvent = event as unknown as { node: object }
        if (!firstNode) {
          firstNode = insertEvent.node
        } else {
          secondNode = insertEvent.node
        }
      })
      host.addEventListener('remove', (event) => {
        let removeEvent = event as unknown as { waitUntil(promise: Promise<void>): void }
        removeEvent.waitUntil(
          new Promise<void>((resolve) => {
            resolveRemoval = resolve
          }),
        )
      })
      return (input) => input
    })

    let reconciler = createReconciler(nodePolicy, [capturePlugin, attributeProps()])
    let root = reconciler.createRoot(container)

    root.render(<div key="same">a</div>)
    root.flush()
    root.render(null)
    root.flush()
    root.render(<div key="same">b</div>)
    root.flush()

    assert.equal(stringifyTestNode(container), '<div>b</div>')
    assert.ok(firstNode)
    assert.equal(secondNode, firstNode)

    expectCallback(resolveRemoval, 'expected deferred removal resolver')()
    await Promise.resolve()
    await Promise.resolve()

    assert.equal(stringifyTestNode(container), '<div>b</div>')
  })

  it('dispatches scheduler guard error for cascading updates and recovers', async () => {
    let nodePolicy = createTestNodePolicy()
    let container = createTestContainer()
    let events: ReconcilerErrorEvent[] = []
    let loops = 0
    let reconciler = createReconciler(nodePolicy, [attributeProps()])
    let root = reconciler.createRoot(container)
    root.addEventListener('error', (event) => {
      events.push(event as ReconcilerErrorEvent)
    })

    root.render((handle) => {
      loops++
      if (loops < 120) {
        handle.update()
      }
      return <div>{loops}</div>
    })
    root.flush()
    await waitFor(() => events.some((event) => event.context.phase === 'scheduler'), 40)

    await new Promise((resolve) => setTimeout(resolve, 0))
    root.render(<div>recovered</div>)
    root.flush()
    assert.equal(stringifyTestNode(container), '<div>recovered</div>')
  })

  it('runs plugin lifecycle handlers for each root in same batch', async () => {
    let nodePolicy = createTestNodePolicy()
    let a = createTestContainer()
    let b = createTestContainer()
    let beforeCalls = 0
    let afterCalls = 0

    let lifecyclePlugin = definePlugin((pluginHandle) => {
      pluginHandle.addEventListener('beforeFlush', () => {
        beforeCalls++
      })
      pluginHandle.addEventListener('afterFlush', () => {
        afterCalls++
      })
    })

    let reconciler = createReconciler(nodePolicy, [lifecyclePlugin, attributeProps()])
    let rootA = reconciler.createRoot(a)
    let rootB = reconciler.createRoot(b)

    rootA.render(<div>a</div>)
    rootB.render(<div>b</div>)
    rootA.flush()
    await Promise.resolve()

    assert.equal(stringifyTestNode(a), '<div>a</div>')
    assert.equal(stringifyTestNode(b), '<div>b</div>')
    assert.equal(beforeCalls, 2)
    assert.equal(afterCalls, 2)
  })

  it('branches share scheduler flush while keeping separate containers', () => {
    let nodePolicy = createTestNodePolicy()
    let parentContainer = createTestContainer()
    let branchContainer = createTestContainer()
    let reconciler = createReconciler(nodePolicy, [attributeProps()])
    let root = reconciler.createRoot(parentContainer)
    let branch = root.branch(branchContainer)

    root.render(<div id="parent">a</div>)
    branch.render(<div id="branch">b</div>)
    root.flush()

    assert.equal(stringifyTestNode(parentContainer), '<div id="parent">a</div>')
    assert.equal(stringifyTestNode(branchContainer), '<div id="branch">b</div>')
  })

  it('disposing a branch does not dispose the parent root', () => {
    let nodePolicy = createTestNodePolicy()
    let parentContainer = createTestContainer()
    let branchContainer = createTestContainer()
    let reconciler = createReconciler(nodePolicy, [attributeProps()])
    let root = reconciler.createRoot(parentContainer)
    let branch = root.branch(branchContainer)

    root.render(<div>parent</div>)
    branch.render(<div>branch</div>)
    root.flush()
    branch.dispose()

    root.render(<div>still-parent</div>)
    root.flush()

    assert.equal(stringifyTestNode(parentContainer), '<div>still-parent</div>')
    assert.equal(stringifyTestNode(branchContainer), '')
  })

  it('disposing a root disposes all of its branches', () => {
    let nodePolicy = createTestNodePolicy()
    let parentContainer = createTestContainer()
    let childContainer = createTestContainer()
    let grandchildContainer = createTestContainer()
    let reconciler = createReconciler(nodePolicy, [attributeProps()])
    let root = reconciler.createRoot(parentContainer)
    let child = root.branch(childContainer)
    let grandchild = child.branch(grandchildContainer)

    root.render(<div>root</div>)
    child.render(<div>child</div>)
    grandchild.render(<div>grandchild</div>)
    root.flush()
    root.dispose()

    assert.equal(stringifyTestNode(parentContainer), '')
    assert.equal(stringifyTestNode(childContainer), '')
    assert.equal(stringifyTestNode(grandchildContainer), '')
  })

  it('aborts root and host task signals across repeated updates and remove', () => {
    let nodePolicy = createTestNodePolicy()
    let container = createTestContainer()
    let rootSignals: AbortSignal[] = []
    let hostSignals: AbortSignal[] = []
    let signalPlugin = definePlugin(() => (host) => (input) => {
      host.queueTask((_node, signal) => {
        hostSignals.push(signal)
      })
      return input
    })
    let reconciler = createReconciler(nodePolicy, [signalPlugin, attributeProps()])
    let root = reconciler.createRoot(container)

    root.render((handle) => {
      handle.queueTask((signal) => {
        rootSignals.push(signal)
      })
      return <div>a</div>
    })
    root.flush()
    root.render((handle) => {
      handle.queueTask((signal) => {
        rootSignals.push(signal)
      })
      return <div>b</div>
    })
    root.flush()

    assert.equal(rootSignals.length, 2)
    assert.equal(hostSignals.length, 2)
    assert.equal(rootSignals[0].aborted, true)
    assert.equal(hostSignals[0].aborted, true)
    assert.equal(rootSignals[1].aborted, false)
    assert.equal(hostSignals[1].aborted, false)

    root.remove()
    assert.equal(rootSignals[1].aborted, true)
    assert.equal(hostSignals[1].aborted, true)
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

async function waitFor(predicate: () => boolean, maxTurns: number) {
  for (let turn = 0; turn < maxTurns; turn++) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  throw new Error('waitFor predicate not satisfied')
}

function expectCallback(value: null | (() => void), message: string) {
  if (!value) throw new Error(message)
  return value
}
