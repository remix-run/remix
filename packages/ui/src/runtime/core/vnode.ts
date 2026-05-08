import type { ElementProps, ElementType, RemixElement, RemixNode } from '../jsx.ts'

export function createRemixElement(
  type: ElementType,
  props: ElementProps | null | undefined,
  key?: string,
): RemixElement {
  return {
    $rmx: true,
    key,
    props: normalizeElementProps(props),
    type,
  }
}

export function isRemixElement(node: RemixNode): node is RemixElement {
  return typeof node === 'object' && node !== null && '$rmx' in node
}

function normalizeElementProps(props: ElementProps | null | undefined): ElementProps {
  if (!props) return {}
  if (!('mix' in props)) return props

  let { mix, ...rest } = props
  let normalizedMix = normalizeMixValue(mix)
  return normalizedMix === undefined ? rest : { ...rest, mix: normalizedMix }
}

function normalizeMixValue(mix: unknown): unknown[] | undefined {
  if (!mix) return undefined

  let normalizedMix: unknown[] = []
  flattenMixValue(mix, normalizedMix)
  return normalizedMix.length === 0 ? undefined : normalizedMix
}

function flattenMixValue(mix: unknown, out: unknown[]): void {
  if (!mix) return

  if (!Array.isArray(mix)) {
    out.push(mix)
    return
  }

  for (let item of mix) {
    flattenMixValue(item, out)
  }
}
