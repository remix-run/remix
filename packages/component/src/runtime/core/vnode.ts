import type { ElementProps, ElementType, RemixElement } from '../jsx.ts'

// Shared across module instances, and enumerable so element spreads retain their identity.
export const REMIX_ELEMENT = Symbol.for('remix.element')

export function createRemixElement(
  type: ElementType,
  props: ElementProps | null | undefined,
  key?: any,
): RemixElement {
  return {
    [REMIX_ELEMENT]: true,
    $rmx: true,
    key,
    props: normalizeElementProps(props),
    type,
  }
}

export function isRemixElement(node: unknown): node is RemixElement {
  if (typeof node !== 'object' || node === null) return false
  if (Reflect.get(node, REMIX_ELEMENT) !== true) return false
  let type = Reflect.get(node, 'type')
  let props = Reflect.get(node, 'props')
  return (
    (typeof type === 'string' || typeof type === 'function') &&
    typeof props === 'object' &&
    props !== null
  )
}

function normalizeElementProps(props: ElementProps | null | undefined): ElementProps {
  if (!props) return {}
  if (!('mix' in props)) return props

  // Fast path: `mix={[a, b]}` with flat, truthy entries is already normalized.
  // Skipping the copy avoids two prop-object spreads per element per render.
  if (isNormalizedMix(props.mix)) return props

  let { mix, ...rest } = props
  let normalizedMix = normalizeMixValue(mix)
  return normalizedMix === undefined ? rest : { ...rest, mix: normalizedMix }
}

function isNormalizedMix(mix: unknown): boolean {
  if (!Array.isArray(mix) || mix.length === 0) return false
  for (let i = 0; i < mix.length; i++) {
    let item = mix[i]
    if (!item || Array.isArray(item)) return false
  }
  return true
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
