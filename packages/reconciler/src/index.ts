export { createReconciler } from './lib/root.ts'
export { definePlugin } from './lib/types.ts'
export { ReconcilerErrorEvent } from './lib/types.ts'
export { createDirective, usePlugin } from './lib/plugins/directive-plugin.ts'
export {
  createTestContainer,
  createTestNodePolicy,
  stringifyTestNode,
} from './testing/test-node-policy.ts'
export { RECONCILER_FRAGMENT } from './testing/jsx.ts'

export type {
  Component,
  CommittedHostNode,
  CommittedNode,
  ErrorPhase,
  UpdateHandle,
  NodeChild,
  HostFactory,
  HostHandle,
  NodeInput,
  NodeRenderNode,
  HostTask,
  NodeTransform,
  NodeTransformInput,
  NodeHandle,
  NodePolicy,
  Plugin,
  PluginHandle,
  PreparedPlugin,
  ReconcilerElement,
  ReconcilerErrorContext,
  ReconcilerRoot,
  RenderNode,
  RenderValue,
  RootTask as Task,
} from './lib/types.ts'

export type { DirectiveDescriptor, DirectiveType, UseValue } from './lib/plugins/directive-plugin.ts'

export type {
  TestContainerNode,
  TestElementNode,
  TestNode,
  TestNodePolicy,
  TestTextNode,
  TestTraversal,
} from './testing/test-node-policy.ts'
