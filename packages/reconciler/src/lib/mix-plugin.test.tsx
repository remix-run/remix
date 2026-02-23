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

  it('passes composed props from earlier mixins into later mixins', () => {
    let seenByLater: Array<{ className?: unknown; title?: unknown }> = []
    let observedClassNames: string[] = []
    let observedTitles: string[] = []

    let first = createMixin<[], EventTarget>((handle) => (_props) => (
      <handle.element {...({ className: 'first', title: 'hello' } as any)} />
    ))

    let second = createMixin<[], EventTarget>((handle) => (props) => {
      seenByLater.push({ className: props.className, title: props.title })
      let existing = typeof props.className === 'string' ? props.className : ''
      return <handle.element {...props} {...({ className: `${existing} second` } as any)} />
    })

    let capturePlugin = definePlugin<EventTarget>({
      phase: 'special',
      keys: ['className', 'title'],
      shouldActivate(context) {
        return (
          typeof context.delta.nextProps.className === 'string' ||
          typeof context.delta.nextProps.title === 'string'
        )
      },
      apply(context) {
        if (typeof context.delta.nextProps.className === 'string') {
          observedClassNames.push(context.delta.nextProps.className)
          context.consume('className')
        }
        if (typeof context.delta.nextProps.title === 'string') {
          observedTitles.push(context.delta.nextProps.title)
          context.consume('title')
        }
      },
    })

    let reconciler = createTestNodeReconciler([mixPlugin as any, capturePlugin as any])
    let root = reconciler.createRoot()
    root.render(<button mix={[first(), second()]}>hello</button>)
    root.flush()

    assert.deepEqual(seenByLater, [{ className: 'first', title: 'hello' }])
    assert.deepEqual(observedClassNames, ['first second'])
    assert.deepEqual(observedTitles, ['hello'])
  })

  it('removes props when later commits no longer return them', () => {
    let includeTitle = true
    let observedTitles: unknown[] = []

    let maybeTitle = createMixin<[], EventTarget>((handle) => (_props) => {
      if (!includeTitle) return <handle.element />
      return <handle.element {...({ title: 'active' } as any)} />
    })

    let titlePlugin = definePlugin<EventTarget>({
      phase: 'special',
      keys: ['title'],
      shouldActivate(context) {
        return 'title' in context.delta.nextProps || context.delta.kind === 'update'
      },
      apply(context) {
        observedTitles.push(context.delta.nextProps.title)
        context.consume('title')
      },
    })

    let reconciler = createTestNodeReconciler([mixPlugin as any, titlePlugin as any])
    let root = reconciler.createRoot()
    root.render(<button mix={[maybeTitle()]}>hello</button>)
    root.flush()

    includeTitle = false
    root.render(<button mix={[maybeTitle()]}>hello</button>)
    root.flush()

    assert.deepEqual(observedTitles, ['active', undefined])
  })

  it('tears down previous mixin runner when descriptor type changes', () => {
    let firstRemovals = 0
    let secondRemovals = 0
    let useFirst = true

    let first = createMixin<[], EventTarget>((handle) => {
      handle.addEventListener('remove', () => {
        firstRemovals++
      })
      return (_props) => <handle.element />
    })

    let second = createMixin<[], EventTarget>((handle) => {
      handle.addEventListener('remove', () => {
        secondRemovals++
      })
      return (_props) => <handle.element />
    })

    let reconciler = createTestNodeReconciler([mixPlugin as any])
    let root = reconciler.createRoot()
    root.render(<button mix={[useFirst ? first() : second()]}>hello</button>)
    root.flush()

    useFirst = false
    root.render(<button mix={[useFirst ? first() : second()]}>hello</button>)
    root.flush()

    root.render(null)
    root.flush()

    assert.equal(firstRemovals, 1)
    assert.equal(secondRemovals, 1)
  })

  it('supports mixins that return literal host elements', () => {
    let literal = createMixin<[], EventTarget>(() => (props) => <button {...props} title="ok" />)
    let seenTitles: string[] = []
    let titlePlugin = definePlugin<EventTarget>({
      phase: 'special',
      keys: ['title'],
      shouldActivate(context) {
        return typeof context.delta.nextProps.title === 'string'
      },
      apply(context) {
        seenTitles.push(context.delta.nextProps.title as string)
        context.consume('title')
      },
    })
    let reconciler = createTestNodeReconciler([mixPlugin as any, titlePlugin as any])
    let root = reconciler.createRoot()
    root.render(<button mix={[literal()]}>hello</button>)
    root.flush()
    assert.deepEqual(seenTitles, ['ok'])
  })

  it('supports calling handle.element directly as a render factory', () => {
    let direct = createMixin<[], EventTarget>((handle) => (props) => {
      let render = handle.element({ update: handle.update }, null)
      return render({ ...props, title: 'from-factory' })
    })
    let seenTitles: string[] = []
    let titlePlugin = definePlugin<EventTarget>({
      phase: 'special',
      keys: ['title'],
      shouldActivate(context) {
        return typeof context.delta.nextProps.title === 'string'
      },
      apply(context) {
        seenTitles.push(context.delta.nextProps.title as string)
        context.consume('title')
      },
    })
    let reconciler = createTestNodeReconciler([mixPlugin as any, titlePlugin as any])
    let root = reconciler.createRoot()
    root.render(<button mix={[direct()]}>hello</button>)
    root.flush()
    assert.deepEqual(seenTitles, ['from-factory'])
  })

  it('tears down removed trailing mixin runners when list shrinks', () => {
    let removals = 0
    let track = createMixin<[string], EventTarget>((handle) => {
      handle.addEventListener('remove', () => {
        removals++
      })
      return (_value, props) => <handle.element {...props} />
    })

    let reconciler = createTestNodeReconciler([mixPlugin as any])
    let root = reconciler.createRoot()
    root.render(<button mix={[track('a'), track('b')]}>hello</button>)
    root.flush()

    root.render(<button mix={[track('a')]}>hello</button>)
    root.flush()

    assert.equal(removals, 1)
  })

  it('dispatches root error events instead of throwing from flush', () => {
    let crashingPlugin = definePlugin<EventTarget>({
      phase: 'special',
      keys: ['data-crash'],
      shouldActivate() {
        return true
      },
      apply() {
        throw new Error('boom')
      },
    })
    let reconciler = createTestNodeReconciler([crashingPlugin as any])
    let root = reconciler.createRoot()
    let errors: string[] = []
    root.addEventListener('error', (event) => {
      let errorEvent = event as Event & { cause?: unknown }
      let cause = errorEvent.cause
      if (cause instanceof Error) errors.push(cause.message)
    })

    root.render(<button data-crash={true}>hello</button>)
    root.flush()

    assert.deepEqual(errors, ['boom'])
  })

  it('reports an error when a mixin returns a non-element', () => {
    let broken = createMixin<[], EventTarget>(() => () => ({ nope: true } as any))
    let reconciler = createTestNodeReconciler([mixPlugin as any])
    let root = reconciler.createRoot()
    let errors: string[] = []
    root.addEventListener('error', (event) => {
      let cause = (event as Event & { cause?: unknown }).cause
      if (cause instanceof Error) errors.push(cause.message)
    })

    root.render(<button mix={[broken()]}>hello</button>)
    root.flush()

    assert.deepEqual(errors, ['mixins must return a reconciler element'])
  })

  it('reports an error when a mixin returns an incompatible host type', () => {
    let broken = createMixin<[], EventTarget>(() => () => <span />)
    let reconciler = createTestNodeReconciler([mixPlugin as any])
    let root = reconciler.createRoot()
    let errors: string[] = []
    root.addEventListener('error', (event) => {
      let cause = (event as Event & { cause?: unknown }).cause
      if (cause instanceof Error) errors.push(cause.message)
    })

    root.render(<button mix={[broken()]}>hello</button>)
    root.flush()

    assert.deepEqual(errors, ['mixins must return an element with the same host type'])
  })

  it('reports an error when a mixin returns a component element', () => {
    let broken = createMixin<[], EventTarget>(() => () => ({
      $rmx: true as const,
      type: () => null,
      key: null,
      props: {},
    }))
    let reconciler = createTestNodeReconciler([mixPlugin as any])
    let root = reconciler.createRoot()
    let errors: string[] = []
    root.addEventListener('error', (event) => {
      let cause = (event as Event & { cause?: unknown }).cause
      if (cause instanceof Error) errors.push(cause.message)
    })

    root.render(<button mix={[broken()]}>hello</button>)
    root.flush()

    assert.deepEqual(errors, ['mixins must return an element with the same host type'])
  })

  it('ignores invalid mix descriptors and only runs valid entries', () => {
    let calls = 0
    let valid = createMixin<[], EventTarget>((handle) => (props) => {
      calls++
      return <handle.element {...props} />
    })
    let titlePlugin = definePlugin<EventTarget>({
      phase: 'special',
      keys: ['title'],
      shouldActivate(context) {
        return typeof context.delta.nextProps.title === 'string'
      },
      apply(context) {
        context.consume('title')
      },
    })
    let reconciler = createTestNodeReconciler([mixPlugin as any, titlePlugin as any])
    let root = reconciler.createRoot()
    root.render(
      <button
        title="ok"
        mix={[null as any, { type: 'nope', args: [] } as any, { foo: true } as any, valid()]}
      />,
    )
    root.flush()
    assert.equal(calls, 1)
  })

})
