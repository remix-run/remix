import { createMixin } from '@remix-run/component'
import type { ElementProps, MixinDescriptor } from '@remix-run/component'
import type { AnimationStyles, AnimationTransition, TransitionOptions } from './transition.ts'

import {
  createNativeAnimationPlayback,
  retainAnimationHost,
  transformProperty,
} from './animation-host.ts'

/** Style values and transition settings for an entrance or exit animation. */
export interface AnimateMixinConfig extends Omit<AnimationStyles, 'transition'>, TransitionOptions {
  /** Per-property overrides for the animation's timing and compositing settings. */
  transition?: AnimationTransition
  /** Skip the first keyed entrance when false (default: true). */
  initial?: boolean
}
type AnimationConfig = true | false | null | undefined | AnimateMixinConfig
type ExitAnimationConfig = AnimationConfig

const DEFAULT_ENTER: AnimateMixinConfig = {
  opacity: 0,
  duration: 150,
  easing: 'ease-out',
}

const DEFAULT_EXIT: AnimateMixinConfig = {
  opacity: 0,
  duration: 150,
  easing: 'ease-in',
}

type AnimationState = {
  animations: Animation[]
  properties: string[]
  stop(): void
}

const animatingNodes = new WeakMap<Element, AnimationState>()
const initialEntranceSeenByParent = new WeakMap<ParentNode, Set<unknown>>()

function extractStyleProps(config: AnimateMixinConfig): Keyframe {
  let result: Keyframe = {}
  for (let [key, value] of Object.entries(config)) {
    if (
      key === 'duration' ||
      key === 'easing' ||
      key === 'delay' ||
      key === 'composite' ||
      key === 'transition' ||
      key === 'initial'
    )
      continue
    if (typeof value !== 'string' && typeof value !== 'number') continue
    result[key] = value
  }
  return result
}

function resolveEnterConfig(config: AnimationConfig): AnimateMixinConfig | null {
  if (!config) return null
  if (config === true) return DEFAULT_ENTER
  return config
}

function resolveExitConfig(config: ExitAnimationConfig): AnimateMixinConfig | null {
  if (!config) return null
  if (config === true) return DEFAULT_EXIT
  return config
}

function toCssPropertyName(property: string): string {
  return property.includes('-')
    ? property
    : property.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)
}

function captureAnimation(node: Element): Keyframe | undefined {
  let current = animatingNodes.get(node)
  if (!current) return
  let computed = getComputedStyle(node)
  let from: Keyframe = {}
  for (let property of current.properties) {
    from[property] = computed.getPropertyValue(
      property === 'transform' ? transformProperty() : toCssPropertyName(property),
    )
  }
  current.stop()
  animatingNodes.delete(node)
  return from
}

function propertyTransition(config: AnimateMixinConfig, property: string): TransitionOptions {
  let { duration, easing, delay, composite } = config
  let override = Object.entries(config.transition ?? {}).find(([name]) => name === property)?.[1]
  return {
    duration: override?.duration ?? duration,
    easing: override?.easing ?? easing,
    delay: override?.delay ?? delay,
    composite: override?.composite ?? composite,
  }
}

function applyImmediateExit(node: Element, config: AnimateMixinConfig): () => void {
  if (!(node instanceof HTMLElement || node instanceof SVGElement)) return () => {}
  let saved: Array<{ property: string; value: string; priority: string }> = []
  for (let [property, value] of Object.entries(extractStyleProps(config))) {
    let timing = propertyTransition(config, property)
    if (
      timing.duration !== 0 ||
      (timing.delay ?? 0) > 0 ||
      property === 'translate' ||
      property === 'transform'
    )
      continue
    let name = toCssPropertyName(property)
    saved.push({
      property: name,
      value: node.style.getPropertyValue(name),
      priority: node.style.getPropertyPriority(name),
    })
    let target = String(value)
    if (timing.composite && timing.composite !== 'replace') {
      // Resolve additive targets against the underlying style before retaining them inline.
      let instant = node.animate([{ [property]: value }], {
        duration: 0,
        fill: 'forwards',
        composite: timing.composite,
      })
      instant.finish()
      target = getComputedStyle(node).getPropertyValue(name)
      instant.cancel()
    }
    node.style.setProperty(name, target)
  }
  return () => {
    for (let { property, value, priority } of saved) {
      if (value) node.style.setProperty(property, value, priority)
      else node.style.removeProperty(property)
    }
  }
}

function startAnimation(
  node: Element,
  config: AnimateMixinConfig,
  direction: 'entrance' | 'exit' | 'reclaim',
  from?: Keyframe,
): AnimationState {
  let registration = node instanceof HTMLElement ? retainAnimationHost(node) : undefined
  let releases: Array<() => void> = []
  let styles = extractStyleProps(config)
  let properties = new Set([...Object.keys(styles), ...Object.keys(from ?? {})])
  let groups = new Map<string, { frames: Keyframe[]; options: KeyframeAnimationOptions }>()
  let animatedProperties: string[] = []
  for (let property of properties) {
    let timing = propertyTransition(config, property)
    if (
      direction === 'exit' &&
      timing.duration === 0 &&
      (timing.delay ?? 0) <= 0 &&
      property !== 'translate' &&
      property !== 'transform'
    )
      continue
    animatedProperties.push(property)
    let options: KeyframeAnimationOptions = {
      duration: timing.duration ?? 150,
      easing: timing.easing ?? 'linear',
      delay: timing.delay ?? 0,
      composite: timing.composite ?? 'replace',
      fill: direction === 'exit' ? 'forwards' : 'backwards',
    }
    let key = property
    let group = groups.get(key)
    if (!group) {
      group = { frames: [{}, {}], options }
      groups.set(key, group)
    }
    let start = from?.[property] ?? (direction === 'entrance' ? styles[property] : undefined)
    let end = direction === 'exit' ? styles[property] : undefined
    if (start !== undefined) group.frames[0][property] = start
    if (end !== undefined) group.frames[1][property] = end
  }
  // An empty keyframe still supplies a retention duration for timing-only exits.
  if (properties.size === 0) {
    if (direction !== 'exit' || config.duration !== 0 || (config.delay ?? 0) > 0) {
      let options: KeyframeAnimationOptions = {
        duration: config.duration ?? 150,
        easing: config.easing,
        delay: config.delay,
        composite: config.composite,
      }
      groups.set('', { frames: [{}, {}], options })
    }
  }
  let animations: Animation[] = []
  for (let [property, { frames, options }] of groups) {
    if (property === 'translate' && registration && node instanceof HTMLElement) {
      let fromPosition =
        frames[0].translate === undefined
          ? {
              x: registration.read('x'),
              y: registration.read('y'),
              z: registration.read('z'),
            }
          : registration.resolveTranslate(
              String(frames[0].translate),
              options.composite !== 'replace',
            )
      let toPosition =
        frames[1].translate === undefined
          ? { x: 0, y: 0, z: 0 }
          : registration.resolveTranslate(
              String(frames[1].translate),
              options.composite !== 'replace',
            )
      for (let axis of ['x', 'y', 'z'] as const) {
        let claim = registration.claim(axis, direction === 'exit' ? 'exit' : 'animation')
        if (!claim) continue
        let from = fromPosition[axis]
        let to = toPosition[axis]
        if (options.composite && options.composite !== 'replace') {
          let base = claim.read()
          from = frames[0].translate === undefined ? base : base + from
          to = frames[1].translate === undefined ? base : base + to
        }
        let playback = createNativeAnimationPlayback(node, axis, from, to, options)
        claim.start(playback.backend)
        releases.push(() => claim.release())
        animations.push(playback.animation)
      }
    } else if (property === 'transform' && registration) {
      releases.push(registration.useTransform())
      let name = transformProperty()
      let playback = registration.playStyle(
        name,
        frames.map((frame) =>
          frame.transform === undefined
            ? {}
            : { [name]: frame.transform === 'none' ? 'translateX(0px)' : frame.transform },
        ),
        options,
      )
      releases.push(playback.stop)
      animations.push(playback.animation)
    } else if (registration) {
      let playback = registration.playStyle(property, frames, options)
      releases.push(playback.stop)
      animations.push(playback.animation)
    } else {
      animations.push(node.animate(frames, options))
    }
  }
  let state = {
    animations,
    properties: animatedProperties,
    stop() {
      for (let release of releases) release()
      if (!registration) for (let animation of animations) animation.cancel()
      registration?.dispose()
    },
  }
  animatingNodes.set(node, state)
  void Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
    if (animatingNodes.get(node) === state && direction !== 'exit') {
      state.stop()
      animatingNodes.delete(node)
    }
  })
  return state
}

function waitForAnimationOrAbort(state: AnimationState, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve()
  return new Promise((resolve) => {
    let settle = () => {
      signal.removeEventListener('abort', settle)
      resolve()
    }
    signal.addEventListener('abort', settle, { once: true })
    void Promise.allSettled(state.animations.map((animation) => animation.finished)).then(settle)
  })
}

function shouldSkipInitialEntrance(
  event: { key?: unknown; parent: ParentNode },
  config: AnimateMixinConfig,
): boolean {
  if (config.initial !== false) return false
  if (event.key == null) return false
  let seenForParent = initialEntranceSeenByParent.get(event.parent)
  if (!seenForParent) {
    seenForParent = new Set<unknown>()
    initialEntranceSeenByParent.set(event.parent, seenForParent)
  }
  if (seenForParent.has(event.key)) return false
  seenForParent.add(event.key)
  return true
}

const animateEntranceMixin = createMixin<Element, [config: AnimationConfig], ElementProps>(
  (handle) => {
    let currentConfig: AnimationConfig = true

    handle.addEventListener('insert', (event) => {
      let node = event.node
      let current = animatingNodes.get(node)
      if (current?.animations.some((animation) => animation.playState === 'running')) {
        return
      }

      let config = resolveEnterConfig(currentConfig)
      if (!config) return
      if (shouldSkipInitialEntrance(event, config)) return
      startAnimation(node, config, 'entrance')
    })

    return (config) => {
      currentConfig = config
      return handle.element
    }
  },
  { ssr: false },
)

const animateExitMixin = createMixin<Element, [config: ExitAnimationConfig], ElementProps>(
  (handle) => {
    let currentConfig: ExitAnimationConfig = true
    let node: Element | null = null
    let restoreInert: (() => void) | undefined
    let restoreStyles: (() => void) | undefined
    let reclaimFrom: Keyframe | undefined

    handle.addEventListener('beforeUpdate', () => {
      if (restoreStyles && node) reclaimFrom = captureAnimation(node)
      restoreStyles?.()
      restoreStyles = undefined
      // Release exit-only inertness before the returning host's props are patched.
      restoreInert?.()
      restoreInert = undefined
    })

    handle.addEventListener('insert', (event) => {
      node = event.node
    })

    handle.addEventListener('reclaimed', (event) => {
      node = event.node
      let from = reclaimFrom ?? captureAnimation(event.node)
      reclaimFrom = undefined
      if (from) {
        let config = resolveEnterConfig(currentConfig) ?? DEFAULT_ENTER
        startAnimation(event.node, config, 'reclaim', from)
      }
    })

    handle.addEventListener('beforeRemove', (event) => {
      let config = resolveExitConfig(currentConfig)
      if (!config) return
      if (!node) throw new Error('Cannot animate an element before it is inserted')
      let exitingNode = node
      let inert = exitingNode.getAttribute('inert')
      exitingNode.setAttribute('inert', '')
      restoreInert = () => {
        if (inert === null) exitingNode.removeAttribute('inert')
        else exitingNode.setAttribute('inert', inert)
      }
      let from = captureAnimation(node)
      restoreStyles = applyImmediateExit(node, config)
      event.persistNode(async (signal) => {
        if (signal.aborted) return
        if (!node) throw new Error('Cannot animate an element before it is inserted')
        let state = startAnimation(node, config, 'exit', from)
        await waitForAnimationOrAbort(state, signal)
      })
    })

    handle.addEventListener('remove', () => {
      if (node) captureAnimation(node)
      restoreStyles?.()
      restoreStyles = undefined
      restoreInert?.()
      restoreInert = undefined
    })

    return (config) => {
      currentConfig = config
      return handle.element
    }
  },
  { ssr: false },
)

/**
 * Animates an element when it is inserted into the DOM.
 *
 * @param config Entrance animation configuration.
 * @returns A mixin descriptor for the target element.
 */
export function animateEntrance<target extends EventTarget = Element>(
  config: AnimationConfig = true,
): MixinDescriptor<target, [AnimationConfig], ElementProps> {
  return animateEntranceMixin(config) as unknown as MixinDescriptor<
    target,
    [AnimationConfig],
    ElementProps
  >
}

/**
 * Animates an element when it is removed from the DOM.
 * The retained element is inert until removal or reclamation.
 *
 * @param config Exit animation configuration.
 * @returns A mixin descriptor for the target element.
 */
export function animateExit<target extends EventTarget = Element>(
  config: ExitAnimationConfig = true,
): MixinDescriptor<target, [ExitAnimationConfig], ElementProps> {
  return animateExitMixin(config) as unknown as MixinDescriptor<
    target,
    [ExitAnimationConfig],
    ElementProps
  >
}
