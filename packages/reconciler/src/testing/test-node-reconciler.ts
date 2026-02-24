import { createReconciler } from '../lib/root.ts'
import { createNodePolicy } from '../lib/types.ts'
import type { Plugin, RenderValue } from '../lib/types.ts'
import { createTestContainer, createTestNodePolicy, stringifyTestNode } from './test-node-policy.ts'
import type { TestContainerNode, TestElementNode, TestNodePolicy } from './test-node-policy.ts'

export function createTestNodeReconciler(plugins: Plugin<TestElementNode>[] = []) {
  let policy = createTestNodePolicy()
  let reconciler = createReconciler({
    policy: createNodePolicy(() => policy),
    plugins,
  })

  return {
    policy,
    createRoot() {
      let container = createTestContainer()
      let root = reconciler.createRoot(container)
      return {
        container,
        addEventListener(...args: Parameters<EventTarget['addEventListener']>) {
          root.addEventListener(...args)
        },
        removeEventListener(...args: Parameters<EventTarget['removeEventListener']>) {
          root.removeEventListener(...args)
        },
        render(value: null | RenderValue) {
          root.render(value)
        },
        flush() {
          root.flush()
        },
        remove() {
          root.remove()
        },
        dispose() {
          root.dispose()
        },
        inspect() {
          return stringifyTestNode(container)
        },
      }
    },
  }
}
