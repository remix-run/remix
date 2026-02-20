import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createTestNodeReconciler } from '../testing/test-node-reconciler.ts'
import { createMixin, mixPlugin } from './mix-plugin.ts'
import { definePlugin } from './types.ts'

describe('mix plugin', () => {
  it('runs mixins with stable per-host setup and unmount cleanup', () => {
    let setupCalls = 0
    let renderCalls = 0
    let seenTypes: string[] = []
    let cleanups = 0

    let track = createMixin<[string], EventTarget>((handle, type) => {
      setupCalls++
      seenTypes.push(type)
      handle.addEventListener('remove', () => {
        cleanups++
      })
      return (value: string = '', props) => {
        renderCalls++
        return <handle.element {...props} data-track={value} />
      }
    })

    let value = 'first'
    let reconciler = createTestNodeReconciler([mixPlugin as any])
    let root = reconciler.createRoot()

    root.render(<button mix={[track(value)]}>hello</button>)
    root.flush()
    assert.equal(setupCalls, 1)
    assert.equal(renderCalls, 1)
    assert.deepEqual(seenTypes, ['button'])
    assert.equal(cleanups, 0)

    value = 'second'
    root.render(<button mix={[track(value)]}>hello</button>)
    root.flush()
    assert.equal(setupCalls, 1)
    assert.equal(renderCalls, 2)
    assert.equal(cleanups, 0)

    root.render(null)
    root.flush()
    assert.equal(cleanups, 1)
  })

  it('merges returned props so routed plugins can apply them', () => {
    let observedClassNames: string[] = []

    let addClass = createMixin<[string], EventTarget>((handle) => (name, currentProps) => {
      let existing = typeof currentProps.className === 'string' ? currentProps.className : ''
      let next = existing ? `${existing} ${name}` : name
      return <handle.element {...currentProps} {...({ className: next } as any)} />
    })

    let classNamePlugin = definePlugin<EventTarget>({
      phase: 'special',
      keys: ['className'],
      shouldActivate(context) {
        return typeof context.delta.nextProps.className === 'string'
      },
      apply(context) {
        observedClassNames.push(context.delta.nextProps.className as string)
        context.consume('className')
      },
    })

    let reconciler = createTestNodeReconciler([mixPlugin as any, classNamePlugin as any])
    let root = reconciler.createRoot()

    root.render(
      <button className="base" mix={[addClass('from-mix')]}>
        hello
      </button>,
    )
    root.flush()
    assert.deepEqual(observedClassNames, ['base from-mix'])

    root.render(
      <button className="next" mix={[addClass('again')]}>
        hello
      </button>,
    )
    root.flush()
    assert.deepEqual(observedClassNames, ['base from-mix', 'next again'])
  })

  it('composes nested mixins returned from mixin render', () => {
    let applied = 0

    let markApplied = createMixin<[], EventTarget>((handle) => (_props) => (
      <handle.element {...({ applied: true } as any)} />
    ))

    let composed = createMixin<[], EventTarget>((handle) => (_props) => (
      <handle.element {...({ mix: [markApplied()] } as any)} />
    ))

    let appliedPlugin = definePlugin<EventTarget>({
      phase: 'special',
      keys: ['applied'],
      shouldActivate(context) {
        return context.delta.nextProps.applied === true
      },
      apply(context) {
        applied++
        context.consume('applied')
      },
    })

    let reconciler = createTestNodeReconciler([mixPlugin as any, appliedPlugin as any])
    let root = reconciler.createRoot()

    root.render(<button mix={[composed()]}>hello</button>)
    root.flush()
    assert.equal(applied, 1)
  })

  it('passes the materialized host node to queueTask', () => {
    let receivedType: null | string = null
    let calls = 0

    let inspectNode = createMixin<[], { type: string }>((handle) => (_props) => {
      handle.queueTask((node) => {
        calls++
        receivedType = node.type
      })
      return <handle.element />
    })

    let reconciler = createTestNodeReconciler([mixPlugin as any])
    let root = reconciler.createRoot()
    root.render(<button mix={[inspectNode()]}>hello</button>)
    root.flush()

    assert.equal(calls, 1)
    assert.equal(receivedType, 'button')
  })
})
