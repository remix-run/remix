import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { RECONCILER_PROP_KEYS } from '../testing/jsx.ts'
import { RECONCILER_NODE_CHILDREN } from '../testing/jsx.ts'
import { jsx } from '../testing/jsx-runtime.ts'
import {
  createTestContainer,
  createTestNodePolicy,
  stringifyTestNode,
} from '../testing/test-node-policy.ts'
import { createTestNodeReconciler } from '../testing/test-node-reconciler.ts'
import type { Component } from '../testing/jsx-runtime.ts'
import { createReconciler } from './root.ts'
import { createNodePolicy, definePlugin } from './types.ts'

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

  it('exposes a stable component handle.id per instance', () => {
    let setupIds: string[] = []
    let renderIds: string[] = []
    let triggerUpdate = () => {}
    let Counter: Component<undefined, {}> = (handle) => {
      setupIds.push(handle.id)
      let count = 0
      triggerUpdate = () => {
        count++
        handle.update()
      }
      return () => {
        renderIds.push(handle.id)
        return <value>{String(count)}</value>
      }
    }

    let reconciler = createTestNodeReconciler()
    let root = reconciler.createRoot()
    root.render(<Counter />)
    root.flush()
    triggerUpdate()
    root.flush()

    assert.equal(setupIds.length, 1)
    assert.match(setupIds[0]!, /^c\d+$/)
    assert.deepEqual(renderIds, [setupIds[0], setupIds[0]])

    root.render(null)
    root.flush()
    root.render(<Counter />)
    root.flush()

    assert.equal(setupIds.length, 2)
    assert.notEqual(setupIds[1], setupIds[0])
    assert.equal(setupIds[1]!.startsWith('c'), true)
  })

  it('provides handle.signal for mounted components', () => {
    let capturedSignal: AbortSignal | undefined
    let App: Component<undefined, {}> = (handle) => {
      capturedSignal = handle.signal
      return () => null
    }
    let reconciler = createTestNodeReconciler()
    let root = reconciler.createRoot()

    root.render(<App />)
    root.flush()

    assert.equal(capturedSignal instanceof AbortSignal, true)
    assert.equal(capturedSignal?.aborted, false)
  })

  it('aborts handle.signal when a component is removed', () => {
    let capturedSignal: AbortSignal | undefined
    let App: Component<undefined, {}> = (handle) => {
      capturedSignal = handle.signal
      return () => null
    }
    let reconciler = createTestNodeReconciler()
    let root = reconciler.createRoot()

    root.render(<App />)
    root.flush()
    assert.equal(capturedSignal?.aborted, false)

    root.render(null)
    root.flush()
    assert.equal(capturedSignal?.aborted, true)
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

  it('provides and reads context values through component ancestry', () => {
    let Provider: Component<undefined, { children?: unknown }> = (handle) => {
      handle.context.set({ value: 'test' })
      return (props) => <wrap>{props.children}</wrap>
    }
    let Child: Component<undefined, {}> = (handle) => {
      let value = handle.context.get(Provider) as { value: string }
      return () => <leaf>{value.value}</leaf>
    }
    let reconciler = createTestNodeReconciler()
    let root = reconciler.createRoot()

    root.render(
      <Provider>
        <Child />
      </Provider>,
    )
    root.flush()

    assert.equal(root.inspect(), '<wrap><leaf>test</leaf></wrap>')
  })

  it('updates descendant context reads after provider updates context and rerenders', () => {
    let updateProvider = () => {}
    let Provider: Component<undefined, { children?: unknown }> = (handle) => {
      let value = 'first'
      handle.context.set({ value })
      updateProvider = () => {
        value = 'second'
        handle.context.set({ value })
        handle.update()
      }
      return (props) => <wrap>{props.children}</wrap>
    }
    let Child: Component<undefined, {}> = (handle) => () => (
      <leaf>{(handle.context.get(Provider) as { value: string }).value}</leaf>
    )
    let reconciler = createTestNodeReconciler()
    let root = reconciler.createRoot()

    root.render(
      <Provider>
        <Child />
      </Provider>,
    )
    root.flush()
    assert.equal(root.inspect(), '<wrap><leaf>first</leaf></wrap>')

    updateProvider()
    root.flush()
    assert.equal(root.inspect(), '<wrap><leaf>second</leaf></wrap>')
  })

  it('returns undefined when no matching context provider exists', () => {
    let MissingProvider: Component<undefined, {}> = () => () => <unused />
    let Consumer: Component<undefined, {}> = (handle) => () => (
      <leaf>{String(handle.context.get(MissingProvider))}</leaf>
    )
    let reconciler = createTestNodeReconciler()
    let root = reconciler.createRoot()

    root.render(<Consumer />)
    root.flush()
    assert.equal(root.inspect(), '<leaf>undefined</leaf>')
  })

  it('prefers nearest provider when multiple providers share the same component type', () => {
    let Provider: Component<undefined, { value: string; children?: unknown }> = (handle) =>
      (props) => {
        handle.context.set({ value: props.value })
        return <wrap>{props.children}</wrap>
      }
    let Consumer: Component<undefined, {}> = (handle) => () => (
      <leaf>{(handle.context.get(Provider) as { value: string }).value}</leaf>
    )
    let reconciler = createTestNodeReconciler()
    let root = reconciler.createRoot()

    root.render(
      <Provider value="outer">
        <Provider value="inner">
          <Consumer />
        </Provider>
      </Provider>,
    )
    root.flush()
    assert.equal(root.inspect(), '<wrap><wrap><leaf>inner</leaf></wrap></wrap>')
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

  it('skips reconciling host children when element children input is referentially stable', () => {
    let memoEnterCount = 0
    let policy = createTestNodePolicy()
    let reconciler = createReconciler({
      policy: createNodePolicy((policyReconciler) => {
        policyReconciler.addEventListener('enterChildren', (event) => {
          let parent = (event as Event & { parent: unknown }).parent as
            | { kind?: unknown; type?: unknown }
            | undefined
          if (parent?.kind === 'element' && parent.type === 'memo') {
            memoEnterCount++
          }
        })
        return policy
      }),
    })
    let container = createTestContainer()
    let root = reconciler.createRoot(container)
    let memoNode = (
      <memo>
        <span>Some text</span>
      </memo>
    )

    root.render(
      <root>
        {memoNode}
        <other>Other stuff</other>
      </root>,
    )
    root.flush()
    assert.equal(memoEnterCount, 1)

    root.render(
      <root>
        {memoNode}
        <other>Other stuff</other>
      </root>,
    )
    root.flush()
    assert.equal(memoEnterCount, 1)
  })

  it('does not skip stable host children when component updates are pending', () => {
    let updateLeaf = () => {}
    let Leaf: Component<undefined, {}> = (handle) => {
      let value = 0
      updateLeaf = () => {
        value++
        handle.update()
      }
      return () => <leaf>{String(value)}</leaf>
    }
    let reconciler = createTestNodeReconciler()
    let root = reconciler.createRoot()
    let memoNode = (
      <memo>
        <Leaf />
      </memo>
    )

    root.render(<root>{memoNode}</root>)
    root.flush()
    assert.equal(root.inspect(), '<root><memo><leaf>0</leaf></memo></root>')

    updateLeaf()
    root.flush()
    assert.equal(root.inspect(), '<root><memo><leaf>1</leaf></memo></root>')
  })

  it('runs routed plugins only when dependencies change', () => {
    let pluginApplies = 0
    let routedPlugin = definePlugin({
      phase: 'special' as const,
      keys: ['data-x'],
      shouldActivate(context) {
        return typeof context.delta.nextProps['data-x'] === 'string'
      },
      setup() {
        return {
          commit() {
            pluginApplies++
          },
        }
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

  it('only marks routed plugins that are still ahead in phase order', () => {
    let order: string[] = []
    let terminalValues: string[] = []
    let seedPlugin = definePlugin<EventTarget>({
      phase: 'special',
      keys: [],
      shouldActivate() {
        return true
      },
      setup() {
        return {
          commit(context) {
            order.push('seed')
            context.replaceProps({
              ...context.delta.nextProps,
              k: 'from-seed',
            })
          },
        }
      },
    })
    let routedOne = definePlugin<EventTarget>({
      phase: 'special',
      keys: ['k'],
      shouldActivate() {
        return true
      },
      setup() {
        return {
          commit() {
            order.push('routed-one')
          },
        }
      },
    })
    let routedTwo = definePlugin<EventTarget>({
      phase: 'special',
      keys: ['k'],
      shouldActivate() {
        return true
      },
      setup() {
        return {
          commit(context) {
            order.push('routed-two')
            // This calls replaceProps after routed plugins have already run, so only
            // plugins ahead of this cursor can be marked for later execution.
            context.replaceProps({
              ...context.delta.nextProps,
              k: 'from-routed-two',
            })
          },
        }
      },
    })
    let terminal = definePlugin<EventTarget>({
      phase: 'terminal',
      keys: ['k'],
      shouldActivate() {
        return true
      },
      setup() {
        return {
          commit(context) {
            terminalValues.push(String(context.delta.nextProps.k))
          },
        }
      },
    })
    let reconciler = createTestNodeReconciler([
      seedPlugin as any,
      routedOne as any,
      routedTwo as any,
      terminal as any,
    ])
    let root = reconciler.createRoot()

    root.render(<item />)
    root.flush()

    assert.deepEqual(order, ['seed', 'routed-one', 'routed-two'])
    assert.deepEqual(terminalValues, ['from-routed-two'])
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

  it('supports root remove and dispose lifecycle', () => {
    let reconciler = createTestNodeReconciler()
    let root = reconciler.createRoot()

    root.render(<a>A</a>)
    root.flush()
    assert.equal(root.inspect(), '<a>A</a>')

    root.remove()
    root.flush()
    assert.equal(root.inspect(), '')

    root.render(<b>B</b>)
    root.flush()
    assert.equal(root.inspect(), '<b>B</b>')

    root.dispose()
    root.render(<c>C</c>)
    root.flush()
    assert.equal(root.inspect(), '')
  })

  it('treats lifecycle methods as no-ops after dispose', async () => {
    let reconciler = createTestNodeReconciler()
    let root = reconciler.createRoot()

    root.render(<a>A</a>)
    root.dispose()
    await Promise.resolve()
    assert.equal(root.inspect(), '')

    root.render(<b>B</b>)
    root.flush()
    root.remove()
    root.dispose()
    assert.equal(root.inspect(), '')
  })

  it('supports plugins without setup scopes', () => {
    let shouldActivateCalls = 0
    let plugin = definePlugin({
      phase: 'special',
      keys: [],
      shouldActivate() {
        shouldActivateCalls++
        return true
      },
    })

    let reconciler = createTestNodeReconciler([plugin])
    let root = reconciler.createRoot()
    root.render(<item />)
    root.flush()
    root.render(<item />)
    root.flush()

    assert.equal(shouldActivateCalls, 1)
    assert.equal(root.inspect(), '<item></item>')
  })

  it('orders same-priority plugins by registration order', () => {
    let order: string[] = []
    let first = definePlugin<EventTarget>({
      phase: 'special',
      priority: 1,
      keys: [],
      shouldActivate() {
        return true
      },
      setup() {
        return {
          commit() {
            order.push('first')
          },
        }
      },
    })
    let second = definePlugin<EventTarget>({
      phase: 'special',
      priority: 1,
      keys: [],
      shouldActivate() {
        return true
      },
      setup() {
        return {
          commit() {
            order.push('second')
          },
        }
      },
    })
    let reconciler = createTestNodeReconciler([first as any, second as any])
    let root = reconciler.createRoot()
    root.render(<item />)
    root.flush()

    assert.deepEqual(order, ['first', 'second'])
  })

  it('runs queued component tasks on a later flush', () => {
    let queued = 0
    let queue = () => {}
    let Test: Component<undefined, {}> = (handle) => {
      queue = () => {
        handle.queueTask(() => {
          queued++
        })
      }
      return () => <node />
    }
    let reconciler = createTestNodeReconciler()
    let root = reconciler.createRoot()
    root.render(<Test />)
    root.flush()

    queue()
    assert.equal(queued, 0)
    root.render(<Test />)
    root.flush()
    assert.equal(queued, 1)
  })

  it('deactivates plugins and runs remove when shouldActivate turns false', () => {
    let mounts = 0
    let unmounts = 0
    let plugin = definePlugin<EventTarget>({
      phase: 'special',
      keys: ['active'],
      shouldActivate(context) {
        return context.delta.nextProps.active === true
      },
      setup() {
        mounts++
        return {
          remove() {
            unmounts++
          },
        }
      },
    })
    let reconciler = createTestNodeReconciler([plugin as any])
    let root = reconciler.createRoot()

    root.render(<item active={true} />)
    root.flush()
    assert.equal(mounts, 1)
    assert.equal(unmounts, 0)

    root.render(<item active={false} />)
    root.flush()
    assert.equal(unmounts, 1)
  })

  it('supports plugin host context replace/consume helpers', () => {
    let seen: Array<Record<string, unknown>> = []
    let plugin = definePlugin<EventTarget>({
      phase: 'special',
      keys: ['x', 'y', 'z'],
      shouldActivate() {
        return true
      },
      setup() {
        return {
          commit(context) {
            context.replaceProps({ z: 'replaced' })
            context.consume('z')
            seen.push({
              zConsumed: context.isConsumed('z'),
              xConsumed: context.isConsumed('x'),
              remaining: context.remainingPropsView(),
            })
          },
        }
      },
    })
    let reconciler = createTestNodeReconciler([plugin as any])
    let root = reconciler.createRoot()
    root.render(<item x="one" />)
    root.flush()

    assert.deepEqual(seen, [{ zConsumed: true, xConsumed: false, remaining: {} }])
    assert.equal(root.inspect(), '<item></item>')
  })

  it('handles component setup prop and fragment children', () => {
    let setupSeen: unknown[] = []
    let propsSetupSeen: unknown[] = []
    let WithSetup: Component<string, { label: string }> = (_handle, setup) => {
      setupSeen.push(setup)
      return (props) => {
        propsSetupSeen.push((props as Record<string, unknown>).setup)
        return (
          <>
            <left>{props.label}</left>
            <>tail</>
          </>
        )
      }
    }
    let reconciler = createTestNodeReconciler()
    let root = reconciler.createRoot()
    root.render(<WithSetup setup="abc" label="ok" />)
    root.flush()

    assert.deepEqual(setupSeen, ['abc'])
    assert.deepEqual(propsSetupSeen, [undefined])
    assert.equal(root.inspect(), '<left>ok</left>')

    root.render(
      <>
        <left>ok</left>
        <>tail</>
      </>,
    )
    root.flush()
    assert.equal(root.inspect(), '<left>ok</left>tail')
  })

  it('supports plugin factories before a root exists', () => {
    let calls = 0
    let pluginFactory = definePlugin<EventTarget>((pluginRoot) => {
      pluginRoot.root.render(null)
      pluginRoot.root.flush()
      pluginRoot.root.remove()
      pluginRoot.root.dispose()
      calls++
      return {
        phase: 'special',
        keys: [],
      }
    })

    let reconciler = createTestNodeReconciler([pluginFactory as any])
    let root = reconciler.createRoot()
    root.render(<node />)
    root.flush()

    assert.equal(calls, 1)
  })

  it('runs setup/terminal plugin paths and teardown context helpers', () => {
    let queued = 0
    let updates = 0
    let setupRemoves = 0
    let terminalRuns = 0
    let unmountReads: Array<{ consumed: boolean; remaining: Record<string, unknown> }> = []

    let setupPlugin = definePlugin<EventTarget>({
      phase: 'special',
      keys: ['enabled'],
      shouldActivate(context) {
        return context.delta.nextProps.enabled === true
      },
      setup(handle) {
        handle.queueTask(() => {
          queued++
        })
        return {
          commit() {
            if (updates === 0) {
              updates++
              void handle.update()
            }
          },
          remove() {
            setupRemoves++
          },
        }
      },
    })

    let terminalPlugin = definePlugin<EventTarget>({
      phase: 'terminal',
      keys: ['enabled'],
      setup() {
        return {
          commit() {
            terminalRuns++
          },
        }
      },
    })

    let teardownPlugin = definePlugin<EventTarget>({
      phase: 'special',
      keys: ['enabled'],
      shouldActivate(context) {
        return context.delta.nextProps.enabled === true
      },
      setup() {
        return {
          commit(context) {
            context.replaceProps({ replaced: true })
            context.consume('replaced')
          },
          remove() {
            unmountReads.push({ consumed: true, remaining: {} })
          },
        }
      },
    })

    let reconciler = createTestNodeReconciler([
      setupPlugin as any,
      teardownPlugin as any,
      terminalPlugin as any,
    ])
    let root = reconciler.createRoot()
    root.render(<item enabled={true} />)
    root.flush()
    root.render(<item enabled={false} />)
    root.flush()

    assert.equal(queued > 0, true)
    assert.equal(updates > 0, true)
    assert.equal(setupRemoves, 1)
    assert.equal(terminalRuns > 0, true)
    assert.deepEqual(unmountReads, [{ consumed: true, remaining: {} }])
  })

  it('handles null setup scopes and routed self-merges safely', () => {
    let unmounts = 0
    let merges = 0
    let nullSlotPlugin = definePlugin<EventTarget>({
      phase: 'special',
      keys: ['active'],
      shouldActivate(context) {
        return context.delta.nextProps.active === true
      },
      setup() {
        return {
          commit(context) {
            merges++
            context.replaceProps({
              ...context.delta.nextProps,
              active: context.delta.nextProps.active,
            })
          },
          remove() {
            unmounts++
          },
        }
      },
    })
    let reconciler = createTestNodeReconciler([nullSlotPlugin as any])
    let root = reconciler.createRoot()

    root.render(<item active={true} />)
    root.flush()
    root.render(<item active={false} />)
    root.flush()

    assert.equal(merges > 0, true)
    assert.equal(unmounts, 1)
  })

  it('reports internal bookkeeping corruption via invariant', () => {
    let corruptedPlugin = definePlugin<EventTarget>({
      phase: 'special',
      keys: ['enabled'],
      shouldActivate(context) {
        return context.delta.nextProps.enabled === true
      },
      setup(handle) {
        return {
          commit() {
            // Simulate internal corruption from unexpected plugin mutation.
            handle.host.activePluginIds.length = 0
          },
        }
      },
    })
    let reconciler = createTestNodeReconciler([corruptedPlugin as any])
    let root = reconciler.createRoot()
    let errors: string[] = []
    root.addEventListener('error', (event) => {
      let cause = (event as Event & { cause?: unknown }).cause
      if (cause instanceof Error) errors.push(cause.message)
    })

    root.render(<item enabled={true} />)
    root.flush()
    root.render(<item enabled={false} />)
    root.flush()

    assert.equal(errors.length > 0, true)
    assert.equal(errors[0]?.includes('active plugin id'), true)
  })

  it('runs remove teardown when host nodes are removed', () => {
    let removals = 0
    let teardownPlugin = definePlugin<EventTarget>({
      phase: 'special',
      keys: ['flag'],
      shouldActivate() {
        return true
      },
      setup() {
        return {
          remove() {
            removals++
          },
        }
      },
    })
    let reconciler = createTestNodeReconciler([teardownPlugin as any])
    let root = reconciler.createRoot()

    root.render(<item flag="on" />)
    root.flush()
    root.render(null)
    root.flush()

    assert.equal(removals, 1)
  })

  it('defers final remove cleanup until retained detach completes', async () => {
    let detachCalls = 0
    let removeCalls = 0
    let resolveDetach = () => {}
    let detachDone = new Promise<void>((resolve) => {
      resolveDetach = resolve
    })
    let plugin = definePlugin<EventTarget>({
      phase: 'special',
      keys: ['flag'],
      shouldActivate() {
        return true
      },
      setup() {
        return {
          detach(event) {
            detachCalls++
            event.retain()
            event.waitUntil(detachDone)
          },
          remove() {
            removeCalls++
          },
        }
      },
    })
    let reconciler = createTestNodeReconciler([plugin as any])
    let root = reconciler.createRoot()

    root.render(<item key="same" flag="on" />)
    root.flush()
    root.render(null)
    root.flush()

    assert.equal(detachCalls, 1)
    assert.equal(removeCalls, 0)
    assert.equal(root.inspect(), '<item></item>')

    resolveDetach()
    await detachDone
    await new Promise((resolve) => setTimeout(resolve, 0))
    root.flush()
    assert.equal(removeCalls, 1)
    assert.equal(root.inspect(), '')
  })

  it('reuses retained keyed hosts without rerunning setup or remove', async () => {
    let setups = 0
    let detachCalls = 0
    let removeCalls = 0
    let resolveDetach = () => {}
    let detachDone = new Promise<void>((resolve) => {
      resolveDetach = resolve
    })
    let plugin = definePlugin<EventTarget>({
      phase: 'special',
      keys: ['flag'],
      shouldActivate() {
        return true
      },
      setup() {
        setups++
        return {
          detach(event) {
            detachCalls++
            event.retain()
            event.waitUntil(detachDone)
          },
          remove() {
            removeCalls++
          },
        }
      },
    })
    let reconciler = createTestNodeReconciler([plugin as any])
    let root = reconciler.createRoot()

    root.render(<item key="same" flag="on" />)
    root.flush()
    root.render(null)
    root.flush()
    assert.equal(root.inspect(), '<item></item>')

    root.render(<item key="same" flag="on" />)
    root.flush()

    assert.equal(root.inspect(), '<item></item>')
    assert.equal(setups, 1)
    assert.equal(detachCalls, 1)
    assert.equal(removeCalls, 0)

    resolveDetach()
    await detachDone
    await new Promise((resolve) => setTimeout(resolve, 0))
    root.flush()

    assert.equal(root.inspect(), '<item></item>')
    assert.equal(removeCalls, 0)
  })

  it('finalizes retained hosts immediately on dispose', () => {
    let removeCalls = 0
    let pending = new Promise<void>(() => {})
    let plugin = definePlugin<EventTarget>({
      phase: 'special',
      keys: ['flag'],
      shouldActivate() {
        return true
      },
      setup() {
        return {
          detach(event) {
            event.retain()
            event.waitUntil(pending)
          },
          remove() {
            removeCalls++
          },
        }
      },
    })
    let reconciler = createTestNodeReconciler([plugin as any])
    let root = reconciler.createRoot()

    root.render(<item key="same" flag="on" />)
    root.flush()
    root.render(null)
    root.flush()
    assert.equal(root.inspect(), '<item></item>')

    root.dispose()
    root.flush()
    assert.equal(root.inspect(), '')
    assert.equal(removeCalls, 1)
  })

  it('handles retained host finalization when node was externally removed', async () => {
    let resolveDetach = () => {}
    let detachDone = new Promise<void>((resolve) => {
      resolveDetach = resolve
    })
    let plugin = definePlugin<EventTarget>({
      phase: 'special',
      keys: ['flag'],
      shouldActivate() {
        return true
      },
      setup() {
        return {
          detach(event) {
            event.retain()
            event.waitUntil(detachDone)
          },
        }
      },
    })
    let reconciler = createTestNodeReconciler([plugin as any])
    let root = reconciler.createRoot()

    root.render(<item key="same" flag="on" />)
    root.flush()
    root.render(null)
    root.flush()
    assert.equal(root.inspect(), '<item></item>')

    let retainedNode = root.container.children[0]
    if (!retainedNode) throw new Error('expected retained node')
    reconciler.policy.remove(root.container, retainedNode as any)
    assert.equal(root.inspect(), '')

    resolveDetach()
    await detachDone
    await new Promise((resolve) => setTimeout(resolve, 0))
    root.flush()
    assert.equal(root.inspect(), '')
  })

  it('handles falsy render values and hosts without children', () => {
    let reconciler = createTestNodeReconciler()
    let root = reconciler.createRoot()

    root.render(false)
    root.flush()
    assert.equal(root.inspect(), '')

    root.render(42n)
    root.flush()
    assert.equal(root.inspect(), '42')

    root.render(<item />)
    root.flush()
    assert.equal(root.inspect(), '<item></item>')
  })

  it('supports components that render null', () => {
    let Maybe: Component<undefined, { show: boolean }> = () => (props) =>
      props.show ? <value>shown</value> : null
    let reconciler = createTestNodeReconciler()
    let root = reconciler.createRoot()

    root.render(<Maybe show={true} />)
    root.flush()
    assert.equal(root.inspect(), '<value>shown</value>')

    root.render(<Maybe show={false} />)
    root.flush()
    assert.equal(root.inspect(), '')
  })

  it('ignores non-element object values in children lists', () => {
    let reconciler = createTestNodeReconciler()
    let root = reconciler.createRoot()
    root.render(<node>{[{ junk: true } as unknown, 'ok']}</node>)
    root.flush()
    assert.equal(root.inspect(), '<node>ok</node>')
  })

  it('allows plugins to dispose root via context facade', () => {
    let calls = 0
    let disposePlugin = definePlugin<EventTarget>({
      phase: 'special',
      keys: ['x'],
      shouldActivate() {
        return true
      },
      setup() {
        return {
          commit(context) {
            if (calls > 0) return
            calls++
            context.root.dispose()
          },
        }
      },
    })
    let reconciler = createTestNodeReconciler([disposePlugin as any])
    let root = reconciler.createRoot()
    root.render(<item x="1" />)
    root.flush()
    root.render(<item x="2" />)
    root.flush()
    assert.equal(calls, 1)
  })

  it('uses symbol prop-key metadata in component shallow-equality checks', () => {
    let renders = 0
    let Comp: Component<undefined, Record<string, unknown>> = () => (props) => {
      renders++
      return <value>{String(props.label)}</value>
    }
    let reconciler = createTestNodeReconciler()
    let root = reconciler.createRoot()

    let firstProps: Record<string, unknown> = { label: 'a' }
    ;(firstProps as any)[RECONCILER_PROP_KEYS] = ['label']
    root.render(jsx(Comp, firstProps))
    root.flush()
    assert.equal(renders, 1)

    let secondProps: Record<string, unknown> = { label: 'a', extra: true }
    ;(secondProps as any)[RECONCILER_PROP_KEYS] = ['label', 'extra']
    root.render(jsx(Comp, secondProps))
    root.flush()
    assert.equal(renders, 2)

    let thirdProps: Record<string, unknown> = { label: 'a' }
    ;(thirdProps as any)[RECONCILER_PROP_KEYS] = ['label']
    root.render(jsx(Comp, thirdProps))
    root.flush()
    assert.equal(renders, 3)

    let fourthProps: Record<string, unknown> = { label: 'a' }
    ;(fourthProps as any)[RECONCILER_PROP_KEYS] = ['label']
    root.render(jsx(Comp, fourthProps))
    root.flush()
    assert.equal(renders, 3)
  })

  it('reads fallback children when node-children cache is missing', () => {
    let manualElement: any = {
      $rmx: true as const,
      type: 'node',
      key: null,
      props: { children: 123 },
    }
    let reconciler = createTestNodeReconciler()
    let root = reconciler.createRoot()
    root.render(manualElement as any)
    root.flush()
    assert.equal(root.inspect(), '<node>123</node>')

    manualElement[RECONCILER_NODE_CHILDREN] = undefined
    manualElement.props.children = ['a', 'b']
    root.render(manualElement as any)
    root.flush()
    assert.equal(root.inspect(), '<node>ab</node>')
  })

  it('renders into a bounded range root without touching sibling content', () => {
    let policy = createTestNodePolicy()
    let container = createTestContainer()
    let before = policy.createElement(container, 'before')
    let start = policy.createText(container, '[')
    let end = policy.createText(container, ']')
    let after = policy.createElement(container, 'after')
    policy.insert(container, before, null)
    policy.insert(container, start, null)
    policy.insert(container, end, null)
    policy.insert(container, after, null)

    let reconciler = createReconciler({
      policy: createNodePolicy(() => policy),
    })
    let root = reconciler.createRoot([start, end])
    root.render(
      <>
        <a>A</a>
        <b>B</b>
      </>,
    )
    root.flush()

    assert.equal(stringifyTestNode(container), '<before></before>[<a>A</a><b>B</b>]<after></after>')
  })

  it('remove() only clears content inside a bounded range root', () => {
    let policy = createTestNodePolicy()
    let container = createTestContainer()
    let before = policy.createElement(container, 'before')
    let start = policy.createText(container, '[')
    let end = policy.createText(container, ']')
    let after = policy.createElement(container, 'after')
    policy.insert(container, before, null)
    policy.insert(container, start, null)
    policy.insert(container, end, null)
    policy.insert(container, after, null)

    let reconciler = createReconciler({
      policy: createNodePolicy(() => policy),
    })
    let root = reconciler.createRoot([start, end])
    root.render(<x>X</x>)
    root.flush()
    assert.equal(stringifyTestNode(container), '<before></before>[<x>X</x>]<after></after>')

    root.remove()
    root.flush()
    assert.equal(stringifyTestNode(container), '<before></before>[]<after></after>')
  })

  it('throws when range root boundaries are invalid', () => {
    let policy = createTestNodePolicy()
    let leftContainer = createTestContainer()
    let rightContainer = createTestContainer()
    let start = policy.createText(leftContainer, 'start')
    let end = policy.createText(rightContainer, 'end')
    policy.insert(leftContainer, start, null)
    policy.insert(rightContainer, end, null)

    let reconciler = createReconciler({
      policy: createNodePolicy(() => policy),
    })
    assert.throws(() => {
      reconciler.createRoot([start, end])
    }, /boundaries must share the same parent/)
  })

  it('throws when range root boundaries are the same node', () => {
    let policy = createTestNodePolicy()
    let container = createTestContainer()
    let marker = policy.createText(container, 'marker')
    policy.insert(container, marker, null)

    let reconciler = createReconciler({
      policy: createNodePolicy(() => policy),
    })
    assert.throws(() => {
      reconciler.createRoot([marker, marker])
    }, /must be distinct/)
  })

  it('throws when range root end boundary does not follow start boundary', () => {
    let policy = createTestNodePolicy()
    let container = createTestContainer()
    let start = policy.createText(container, 'start')
    let end = policy.createText(container, 'end')
    policy.insert(container, end, null)
    policy.insert(container, start, null)

    let reconciler = createReconciler({
      policy: createNodePolicy(() => policy),
    })
    assert.throws(() => {
      reconciler.createRoot([start, end])
    }, /must follow start/)
  })

  it('dispatches enter/leave children lifecycle events to node policies', () => {
    let observed: string[] = []
    let policy = createTestNodePolicy()
    let reconciler = createReconciler({
      policy: createNodePolicy((policyReconciler) => {
        policyReconciler.addEventListener('enterChildren', (event) => {
          let enter = event as Event & { parent: unknown; endAnchor: unknown }
          observed.push(`enter:${enter.endAnchor == null ? 'null' : 'node'}`)
          assert.ok(enter.parent != null)
        })
        policyReconciler.addEventListener('leaveChildren', (event) => {
          let leave = event as Event & { parent: unknown; endAnchor: unknown }
          observed.push(`leave:${leave.endAnchor == null ? 'null' : 'node'}`)
          assert.ok(leave.parent != null)
        })
        return policy
      }),
    })
    let container = createTestContainer()
    let root = reconciler.createRoot(container)
    root.render(
      <root>
        <a>A</a>
      </root>,
    )
    root.flush()

    assert.equal(observed.length > 0, true)
    assert.equal(observed.filter((entry) => entry.startsWith('enter')).length, 3)
    assert.equal(observed.filter((entry) => entry.startsWith('leave')).length, 3)
  })
})
