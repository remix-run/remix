import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createDirective, createReconciler, definePlugin, usePlugin } from '../index.ts'
import {
  createTestContainer,
  createTestNodePolicy,
  stringifyTestNode,
} from '../testing/test-node-policy.ts'
import type { Plugin } from './types.ts'

describe('use plugin', () => {
  it('runs directive plugin scope once and host scope per host', () => {
    let pluginScopeCalls = 0
    let hostScopeCalls = 0
    let updates: string[] = []
    let value = 'first'

    let track = createDirective<{ attributes: Record<string, string> }, [string]>((_pluginHandle) => {
      pluginScopeCalls++
      return (_node) => {
        hostScopeCalls++
        return (nextValue: string) => {
          updates.push(nextValue)
        }
      }
    })

    let nodePolicy = createTestNodePolicy()
    let container = createTestContainer()
    let reconciler = createReconciler(nodePolicy, [
      usePlugin(),
      attributeProps<{ attributes: Record<string, string> }>(),
    ])
    let root = reconciler.createRoot(container)

    root.render(
      <div>
        <a id="a" use={[track(value)]}>
          A
        </a>
        <a id="b" use={[track(value)]}>
          B
        </a>
      </div>,
    )
    root.flush()

    assert.equal(pluginScopeCalls, 1)
    assert.equal(hostScopeCalls, 2)
    assert.deepEqual(updates, ['first', 'first'])
    assert.equal(stringifyTestNode(container), '<div><a id="a">A</a><a id="b">B</a></div>')

    value = 'second'
    root.render(
      <div>
        <a id="a" use={[track(value)]}>
          A
        </a>
        <a id="b" use={[track(value)]}>
          B
        </a>
      </div>,
    )
    root.flush()

    assert.equal(pluginScopeCalls, 1)
    assert.equal(hostScopeCalls, 2)
    assert.deepEqual(updates, ['first', 'first', 'second', 'second'])
  })

  it('runs directive cleanup when use descriptors are removed', () => {
    let applied = 0
    let cleaned = 0

    let track = createDirective<{ attributes: Record<string, string> }, [string]>((_pluginHandle) => {
      return (_node) => {
        return (...args: [string?]) => {
          if (args.length === 0) {
            cleaned++
            return
          }
          applied++
        }
      }
    })

    let nodePolicy = createTestNodePolicy()
    let container = createTestContainer()
    let reconciler = createReconciler(nodePolicy, [
      usePlugin(),
      attributeProps<{ attributes: Record<string, string> }>(),
    ])
    let root = reconciler.createRoot(container)

    root.render(<button use={[track('on')]}>Click</button>)
    root.flush()
    assert.equal(applied, 1)
    assert.equal(cleaned, 0)

    root.render(<button>Click</button>)
    root.flush()
    assert.equal(applied, 1)
    assert.equal(cleaned, 1)
    assert.equal(stringifyTestNode(container), '<button>Click</button>')
  })
})

function attributeProps<
  elementNode extends { attributes: Record<string, string> },
>(): Plugin<elementNode> {
  return definePlugin<elementNode>(() => ({
    keys: '*',
    setup() {
      let current = new Set<string>()
      return {
        commit(input, node) {
          let next = new Map<string, string>()
          for (let key in input.props) {
            let value = input.props[key]
            if (value == null || value === false) continue
            if (typeof value === 'object' || typeof value === 'function') continue
            next.set(key, String(value))
          }
          for (let key of current) {
            if (next.has(key)) continue
            delete node.attributes[key]
          }
          for (let [key, value] of next) {
            node.attributes[key] = value
          }
          current = new Set(next.keys())
        },
        remove(node, reason) {
          if (reason === 'unmount') return
          for (let key of current) {
            delete node.attributes[key]
          }
          current.clear()
        },
      }
    },
  }))
}
