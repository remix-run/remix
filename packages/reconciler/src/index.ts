export { createReconciler } from './lib/root.ts'
export { definePlugin } from './lib/types.ts'
export { ReconcilerErrorEvent } from './lib/types.ts'
export { createMixin, mixPlugin } from './lib/mix-plugin.ts'
export { createTestNodeReconciler } from './testing/test-node-reconciler.ts'
export {
  createTestContainer,
  createTestNodePolicy,
  stringifyTestNode,
} from './testing/test-node-policy.ts'
export { RECONCILER_FRAGMENT } from './testing/jsx.ts'
export { RECONCILER_NODE_CHILDREN } from './testing/jsx.ts'
export { RECONCILER_PROP_KEYS } from './testing/jsx.ts'
export { RECONCILER_PROP_SHAPE } from './testing/jsx.ts'

export type {
  Component,
  CommittedHostNode,
  CommittedNode,
  HostPropDelta,
  UpdateHandle,
  HostInput,
  NodePolicy,
  Plugin,
  PluginHostContext,
  PluginPhase,
  PreparedPlugin,
  ReconcilerElement,
  ReconcilerRoot,
  RenderNode,
  RenderValue,
  RootTask as Task,
} from './lib/types.ts'

export type { MixinDescriptor, MixinType, MixValue } from './lib/mix-plugin.ts'

export type {
  TestContainerNode,
  TestElementNode,
  TestNode,
  TestNodePolicy,
  TestTextNode,
  TestTraversal,
} from './testing/test-node-policy.ts'
