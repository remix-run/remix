export { createOpenTuiHostBridge } from './lib/tui-host.ts'
export {
  assertTuiTreeConsistency,
  createTuiContainer,
  createTuiNodePolicy,
} from './lib/tui-node-policy.ts'
export { createTuiReconciler, createOpenTuiRoot } from './lib/tui-reconciler.ts'
export {
  basicPropsPlugin,
  createTuiPlugins,
  inputEventPlugin,
  layoutPlugin,
  stylePlugin,
} from './lib/tui-plugins.ts'
export { Fragment, jsx, jsxs } from './jsx-runtime.ts'
export { jsxDEV } from './jsx-dev-runtime.ts'

export type { Component, Plugin } from '@remix-run/reconciler'
export type { TuiHostBridge, TuiHostNode } from './lib/tui-host.ts'
export type {
  TuiContainerNode,
  TuiElementNode,
  TuiNode,
  TuiNodePolicy,
  TuiParentNode,
  TuiTextNode,
} from './lib/tui-node-policy.ts'
export type { CreateTuiReconcilerOptions } from './lib/tui-reconciler.ts'
export type {
  TuiElementProps,
  TuiJsxElement,
  TuiLayoutValue,
  TuiOnValue,
  TuiStyleValue,
} from './jsx-runtime.ts'
