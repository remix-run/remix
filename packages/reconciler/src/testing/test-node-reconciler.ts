import { createReconciler } from '../lib/root.ts'
import type { Plugin, RenderValue } from '../lib/types.ts'
import {
  createTestContainer,
  createTestNodePolicy,
  stringifyTestNode,
} from './test-node-policy.ts'
import type {
  TestContainerNode,
  TestElementNode,
  TestNode,
  TestNodePolicy,
  TestTextNode,
} from './test-node-policy.ts'

export function createTestNodeReconciler(
  plugins: Plugin<TestContainerNode, TestNode, TestTextNode, TestElementNode>[] = [],
) {
  let policy = createTestNodePolicy()
  let reconciler = createReconciler({
    policy,
    plugins,
  })

  return {
    policy,
    createRoot() {
      let container = createTestContainer()
      let root = reconciler.createRoot(container)
      return {
        container,
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
