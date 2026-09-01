import type { ElementProps, RemixElement } from '../jsx.ts'

// Composition stops processing descriptors past this bound so a mixin that
// returns itself cannot expand forever.
export const MAX_MIX_DESCRIPTORS = 1024

/**
 * Structural shape of a mixin descriptor as stored in the `mix` prop, shared
 * by the client runtime and the server renderer.
 */
export interface MixDescriptor {
  type: (...args: any[]) => unknown
  args: readonly unknown[]
}

/**
 * Environment hook that turns a descriptor into an invocable runner.
 *
 * The client resolves runners against persistent per-element state (scopes,
 * lifecycle events); the server creates a one-shot runner per descriptor.
 * Returning `null` skips the descriptor. The returned function receives the
 * mixin-visible props for the current composition step and returns the
 * mixin's raw result.
 */
export type MixRunnerResolver = (
  descriptor: MixDescriptor,
  index: number,
) => ((mixinProps: ElementProps) => unknown) | null

export interface ComposedMixedProps {
  props: ElementProps
  /**
   * Number of descriptors processed, including descriptors appended during
   * composition by mixins that returned more mixins.
   */
  descriptorCount: number
}

/**
 * Composes an element's `mix` descriptors into its final props.
 *
 * This is the single owner of mixin composition semantics: descriptor
 * expansion, host type validation, returned-prop sanitization, and prop
 * merge order. Both the client reconciler and the server renderer run this
 * loop, supplying their own `resolveRunner`.
 *
 * @param hostType Host element tag name the mixins are composed for.
 * @param props Original element props, including `mix`.
 * @param resolveRunner Environment hook that turns each descriptor into an invocable runner.
 * @returns The composed props and the number of descriptors processed.
 */
export function composeMixedProps(
  hostType: string,
  props: ElementProps,
  resolveRunner: MixRunnerResolver,
): ComposedMixedProps {
  let descriptors = resolveMixDescriptors(props)
  let composedProps = withoutMix(props)
  let mixinProps = withoutMixinTreeProps(composedProps)

  for (let index = 0; index < descriptors.length && index < MAX_MIX_DESCRIPTORS; index++) {
    let descriptor = descriptors[index]
    let runner = resolveRunner(descriptor, index)
    if (!runner) continue

    let result = runner(mixinProps)
    if (!result) continue
    if (isMixinElementFunction(result)) continue

    let returnedDescriptors = resolveReturnedMixDescriptors(result)
    if (returnedDescriptors) {
      for (let returned of returnedDescriptors) descriptors.push(returned)
      continue
    }

    if (!isRemixElementResult(result)) {
      console.error(new Error('mixins must return a remix element'))
      continue
    }

    let resultType =
      typeof result.type === 'string'
        ? result.type
        : isMixinElementFunction(result.type)
          ? result.type.__rmxMixinElementType
          : null
    if (resultType !== hostType) {
      console.error(new Error('mixins must return an element with the same host type'))
      continue
    }

    let nextProps = sanitizeReturnedMixinProps(result.props)
    for (let nested of resolveMixDescriptors(nextProps)) descriptors.push(nested)
    composedProps = { ...composedProps, ...withoutMix(nextProps) }
    mixinProps = withoutMixinTreeProps(composedProps)
  }

  let nextMix = props.mix
  return {
    descriptorCount: descriptors.length,
    props: {
      ...composedProps,
      ...(nextMix === undefined ? {} : { mix: nextMix }),
    },
  }
}

export function resolveMixDescriptors(props: ElementProps): MixDescriptor[] {
  let mix = props.mix
  if (!mix) return []
  if (Array.isArray(mix)) {
    if (mix.length === 0) return []
    return mix.filter(Boolean) as MixDescriptor[]
  }
  return [mix] as MixDescriptor[]
}

export function withoutMix(props: ElementProps): ElementProps {
  if (!('mix' in props)) return props
  let output = { ...props }
  delete output.mix
  return output
}

export function withoutMixinTreeProps(props: ElementProps): ElementProps {
  if (!('children' in props) && !('innerHTML' in props)) return props
  let output = { ...props }
  delete output.children
  delete output.innerHTML
  return output
}

function sanitizeReturnedMixinProps(props: ElementProps): ElementProps {
  if (!('children' in props) && !('innerHTML' in props)) return props
  console.error(new Error('mixins must not return children or innerHTML'))
  return withoutMixinTreeProps(props)
}

export function isMixinDescriptor(value: unknown): value is MixDescriptor {
  if (!value || typeof value !== 'object' || isRemixElementResult(value)) {
    return false
  }

  let descriptor = value as { type?: unknown; args?: unknown }
  return typeof descriptor.type === 'function' && Array.isArray(descriptor.args)
}

export function isMixinElementFunction(
  value: unknown,
): value is ((...args: unknown[]) => unknown) & { __rmxMixinElementType: string } {
  if (typeof value !== 'function') return false
  return '__rmxMixinElementType' in value
}

function isRemixElementResult(value: unknown): value is RemixElement {
  if (!value || typeof value !== 'object') return false
  return (value as { $rmx?: unknown }).$rmx === true
}

function resolveReturnedMixDescriptors(value: unknown): MixDescriptor[] | null {
  let descriptors: MixDescriptor[] = []
  if (!collectReturnedMixDescriptors(value, descriptors)) {
    return null
  }

  return descriptors
}

function collectReturnedMixDescriptors(value: unknown, output: MixDescriptor[]): boolean {
  if (!value) {
    return true
  }

  if (Array.isArray(value)) {
    for (let item of value) {
      if (!collectReturnedMixDescriptors(item, output)) {
        return false
      }
    }
    return true
  }

  if (!isMixinDescriptor(value)) {
    return false
  }

  output.push(value)
  return true
}
