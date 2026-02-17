import type { ReconcilerElement } from '../lib/types.ts'

export const RECONCILER_ELEMENT_SYMBOL = Symbol.for('remix.reconciler.element')
export const RECONCILER_FRAGMENT = Symbol.for('remix.reconciler.fragment')
export const RECONCILER_NODE_CHILDREN = '__rmxNodeChildren'
export const RECONCILER_PROP_KEYS = '__rmxPropKeys'
export const RECONCILER_PROP_SHAPE = '__rmxPropShape'

export function createReconcilerElement(
  type: unknown,
  props: Record<string, unknown>,
  key: unknown,
): ReconcilerElement {
  return {
    $rmx: true,
    type,
    key,
    props,
  }
}

export function isReconcilerElement(value: unknown): value is ReconcilerElement {
  if (!value || typeof value !== 'object') return false
  let record = value as { $rmx?: unknown }
  return record.$rmx === true
}
