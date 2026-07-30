import type { RemixNode } from '../jsx.ts'
import { invariant } from '../invariant.ts'
import { isRemixElement } from './vnode.ts'

export type EmptyChild = boolean | null | undefined
export type PrimitiveChild = string | number | bigint

export function isEmptyChild(value: RemixNode): value is EmptyChild {
  return value == null || typeof value === 'boolean'
}

export function isPrimitiveChild(value: RemixNode): value is PrimitiveChild {
  let type = typeof value
  return type === 'string' || type === 'number' || type === 'bigint'
}

export function normalizeChildren(children: readonly RemixNode[]): RemixNode[] {
  for (let i = 0; i < children.length; i++) {
    if (Array.isArray(children[i])) {
      return (children as unknown[]).flat(Infinity) as RemixNode[]
    }
  }

  return children as RemixNode[]
}

export function assertRemixNodes(values: readonly unknown[]): asserts values is RemixNode[] {
  for (let value of values) {
    invariant(isRemixNode(value), 'Invalid child node')
  }
}

export function isRemixNode(value: unknown): value is RemixNode {
  if (value == null) return true
  let type = typeof value
  if (type === 'string' || type === 'number' || type === 'bigint' || type === 'boolean') {
    return true
  }
  if (isRemixElement(value)) return true
  if (!Array.isArray(value)) return false
  for (let child of value) {
    if (!isRemixNode(child)) return false
  }
  return true
}

export function packChildren(children: readonly RemixNode[]): RemixNode | undefined {
  if (children.length === 0) {
    return undefined
  }

  if (children.length === 1) {
    let child = children[0]

    if (child === undefined || isEmptyChild(child)) {
      return undefined
    }

    return Array.isArray(child) ? normalizeChildren(child) : child
  }

  let normalized = normalizeChildren(children)
  return normalized.length === 0 ? undefined : normalized
}
