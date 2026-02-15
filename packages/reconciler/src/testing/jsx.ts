import type { ReconcilerElement } from '../lib/types.ts'

export const RECONCILER_ELEMENT_SYMBOL = Symbol.for('remix.reconciler.element')
export const RECONCILER_FRAGMENT = Symbol.for('remix.reconciler.fragment')

export function createReconcilerElement(
  type: unknown,
  props: Record<string, unknown>,
  key: unknown,
): ReconcilerElement {
  return {
    $rcn: true,
    type,
    key,
    props,
  }
}

export function isReconcilerElement(value: unknown): value is ReconcilerElement {
  if (!value || typeof value !== 'object') return false
  let record = value as { $rcn?: unknown }
  return record.$rcn === true
}
