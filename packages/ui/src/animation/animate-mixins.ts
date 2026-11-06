import { createMixin } from '@remix-run/component'
import type { ElementProps, MixinDescriptor } from '@remix-run/component'

type AnimateTiming = {
  duration: number
  easing?: string
  delay?: number
  composite?: CompositeOperation
  initial?: boolean
}

type AnimateStyleProps = {
  [property: string]: unknown
}

/** Style values and shared timing for entrance and exit animations. */
export type AnimateMixinConfig = AnimateTiming &
  AnimateStyleProps & {
    /** Per-property overrides inherit the shared timing and compositing settings. */
    transition?: Record<string, Partial<Omit<AnimateTiming, 'initial'>> | undefined>
  }

type AnimationConfig = true | false | null | undefined | AnimateMixinConfig

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
}

type ExitAnimationPlayback = AnimationState & {
  immediateAnimations: Animation[]
  finished: Promise<unknown>
}

type PendingExitAnimation = ExitAnimationPlayback & {
  reclaimKeyframe?: Keyframe
  cancel(): void
  waitForFinish(signal: AbortSignal): Promise<void>
}

const animatingNodes = new WeakMap<Element, AnimationState>()
const initialEntranceSeenByParent = new WeakMap<ParentNode, Set<unknown>>()

function extractStyleProps(config: AnimateMixinConfig): Keyframe {
  let result: Keyframe = {}
  for (let key in config) {
    if (
      key === 'duration' ||
      key === 'easing' ||
      key === 'delay' ||
      key === 'composite' ||
      key === 'initial' ||
      key === 'transition'
    ) {
      continue
    }
    let value = config[key]
    if (value === undefined) continue
    if (typeof value !== 'string' && typeof value !== 'number') continue
    result[key as keyof Keyframe] = value
  }
  return result
}

function buildEnterKeyframes(config: AnimateMixinConfig): Keyframe[] {
  let keyframe = extractStyleProps(config)
  return [keyframe, {}]
}

function buildExitKeyframes(config: AnimateMixinConfig): Keyframe[] {
  let keyframe = extractStyleProps(config)
  return [{}, keyframe]
}

function resolveEnterConfig(config: AnimationConfig): AnimateMixinConfig | null {
  if (!config) return null
  if (config === true) return DEFAULT_ENTER
  return config
}

function resolveExitConfig(config: AnimationConfig): AnimateMixinConfig | null {
  if (!config) return null
  if (config === true) return DEFAULT_EXIT
  return config
}

function createAnimationOptions(config: AnimateTiming, fill: FillMode): KeyframeAnimationOptions {
  return {
    duration: config.duration,
    delay: config.delay,
    easing: config.easing,
    composite: config.composite,
    fill,
  }
}

function collectAnimatedProperties(keyframes: Keyframe[]): string[] {
  let properties = new Set<string>()
  for (let keyframe of keyframes) {
    for (let key in keyframe) {
      if (key === 'offset' || key === 'easing' || key === 'composite') continue
      properties.add(key)
    }
  }
  return [...properties]
}

function toCssPropertyName(property: string): string {
  return property.includes('-')
    ? property
    : property.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`)
}

function readInlineStyle(style: CSSStyleDeclaration, property: string): string {
  return style.getPropertyValue(toCssPropertyName(property))
}

function writeInlineStyle(style: CSSStyleDeclaration, property: string, value: string): void {
  let cssProperty = toCssPropertyName(property)
  if (value === '') {
    style.removeProperty(cssProperty)
    return
  }
  style.setProperty(cssProperty, value)
}

function readComputedKeyframe(node: Element, properties: string[]): Keyframe {
  let computed = getComputedStyle(node)
  let keyframe: Keyframe = {}
  for (let property of properties) {
    keyframe[property as keyof Keyframe] = computed.getPropertyValue(toCssPropertyName(property))
  }
  return keyframe
}

function propertyTiming(config: AnimateMixinConfig, property: string): AnimateTiming {
  let override = config.transition?.[property]
  return {
    duration: override?.duration ?? config.duration,
    easing: override?.easing ?? config.easing ?? 'linear',
    delay: override?.delay ?? config.delay ?? 0,
    composite: override?.composite ?? config.composite ?? 'replace',
  }
}

type AnimationGroup = {
  timing: AnimateTiming
  properties: string[]
}

function groupAnimationProperties(
  config: AnimateMixinConfig,
  properties: string[],
): AnimationGroup[] {
  if (!config.transition) return [{ timing: config, properties }]
  let groups = new Map<string, AnimationGroup>()
  for (let property of properties) {
    let timing = propertyTiming(config, property)
    let key = JSON.stringify([timing.duration, timing.delay, timing.easing, timing.composite])
    let group = groups.get(key)
    if (group) {
      group.properties.push(property)
    } else {
      groups.set(key, { timing, properties: [property] })
    }
  }
  return groups.size > 0 ? [...groups.values()] : [{ timing: config, properties: [] }]
}

function selectKeyframeProperties(keyframe: Keyframe, properties: string[]): Keyframe {
  let result: Keyframe = {
    offset: keyframe.offset,
    easing: keyframe.easing,
    composite: keyframe.composite,
  }
  for (let property of properties) {
    let value = keyframe[property as keyof Keyframe]
    if (value !== undefined) result[property as keyof Keyframe] = value
  }
  return result
}

function createAnimations(
  node: Element,
  keyframes: Keyframe[],
  groups: AnimationGroup[],
  fill: FillMode,
  propertyCount: number,
): Animation[] {
  let animations: Animation[] = []
  try {
    for (let group of groups) {
      let groupKeyframes =
        group.properties.length === propertyCount
          ? keyframes
          : keyframes.map((frame) => selectKeyframeProperties(frame, group.properties))
      let options = createAnimationOptions(group.timing, fill)
      animations.push(node.animate(groupKeyframes, options))
    }
  } catch (error) {
    for (let animation of animations) animation.cancel()
    throw error
  }
  return animations
}

function trackAnimations(
  node: Element,
  animations: Animation[],
  properties: string[],
): AnimationState {
  let state = { animations, properties }
  animatingNodes.set(node, state)
  void Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
    if (animatingNodes.get(node) === state) animatingNodes.delete(node)
  })
  return state
}

function startAnimation(
  node: Element,
  keyframes: Keyframe[],
  config: AnimateMixinConfig,
  fill: FillMode,
): AnimationState {
  let properties = collectAnimatedProperties(keyframes)
  let groups = groupAnimationProperties(config, properties)
  let animations = createAnimations(node, keyframes, groups, fill, properties.length)
  return trackAnimations(node, animations, properties)
}

function startExitAnimation(node: Element, config: AnimateMixinConfig): ExitAnimationPlayback {
  let keyframes = buildExitKeyframes(config)
  let properties = collectAnimatedProperties(keyframes)
  let groups = groupAnimationProperties(config, properties)
  let immediateGroups: AnimationGroup[] = []
  let animatedGroups: AnimationGroup[] = []
  for (let group of groups) {
    if (
      group.properties.length > 0 &&
      group.timing.duration === 0 &&
      (group.timing.delay ?? 0) <= 0
    ) {
      immediateGroups.push(group)
    } else {
      animatedGroups.push(group)
    }
  }
  let immediateAnimations: Animation[] = []
  let animationState: AnimationState | undefined
  try {
    immediateAnimations = createAnimations(
      node,
      [keyframes[1]],
      immediateGroups,
      'forwards',
      properties.length,
    )
    // Update layout before commit measurements without mutating authored inline styles.
    for (let animation of immediateAnimations) animation.finish()

    let trackedAnimation = animatingNodes.get(node)
    if (
      trackedAnimation &&
      trackedAnimation.animations.some((animation) => animation.playState === 'running')
    ) {
      animationState = trackedAnimation
      for (let animation of trackedAnimation.animations) animation.reverse()
    } else if (animatedGroups.length > 0) {
      let animations = createAnimations(
        node,
        keyframes,
        animatedGroups,
        'forwards',
        properties.length,
      )
      let animatedProperties = animatedGroups.flatMap((group) => group.properties)
      animationState = trackAnimations(node, animations, animatedProperties)
    }
  } catch (error) {
    for (let animation of immediateAnimations) animation.cancel()
    for (let animation of animationState?.animations ?? []) animation.cancel()
    throw error
  }
  // Cancellation replaces Animation.finished, so capture it before other removal listeners run.
  let animations = [...(animationState?.animations ?? []), ...immediateAnimations]
  let finished = Promise.allSettled(animations.map((animation) => animation.finished))
  return {
    animations: animationState?.animations ?? [],
    properties: animationState?.properties ?? [],
    immediateAnimations,
    finished,
  }
}

function waitForFinishOrAbort(finished: Promise<unknown>, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve()
  return new Promise((resolve) => {
    let settle = () => {
      signal.removeEventListener('abort', settle)
      resolve()
    }
    signal.addEventListener('abort', settle, { once: true })
    void finished.then(settle, settle)
  })
}

function createPendingExitAnimation(
  node: Element,
  config: AnimateMixinConfig,
): PendingExitAnimation {
  let wasConnected = node.isConnected
  let playback = startExitAnimation(node, config)
  let retentionSignal: AbortSignal | undefined
  let cancelled = false
  let pendingExit: PendingExitAnimation = {
    ...playback,
    cancel() {
      if (cancelled) return
      cancelled = true
      retentionSignal?.removeEventListener('abort', abortExit)
      for (let animation of playback.animations) animation.cancel()
      for (let animation of playback.immediateAnimations) animation.cancel()
    },
    async waitForFinish(signal) {
      retentionSignal = signal
      if (signal.aborted || (wasConnected && !node.isConnected)) {
        pendingExit.cancel()
        return
      }
      // Keep the abort listener after playback while another mixin can still retain the node.
      signal.addEventListener('abort', abortExit, { once: true })
      await waitForFinishOrAbort(playback.finished, signal)
    },
  }
  let abortExit = () => {
    for (let animation of playback.immediateAnimations) animation.cancel()
    if (playback.animations.length === 0) return

    // Interrupted shared animations still use commitStyles during reclamation.
    if (!config.transition) {
      let finished = playback.animations.every((animation) => animation.playState === 'finished')
      if (!finished) return
    }
    pendingExit.reclaimKeyframe = readComputedKeyframe(node, playback.properties)
    pendingExit.cancel()
  }
  return pendingExit
}

function prepareReclaimedElement(
  node: Element,
  pendingExit: PendingExitAnimation | undefined,
): Keyframe | undefined {
  try {
    if (pendingExit) {
      for (let animation of pendingExit.immediateAnimations) animation.cancel()
      if (pendingExit.reclaimKeyframe) return pendingExit.reclaimKeyframe

      // Another mixin may retain the element after its exit animation finishes.
      if (pendingExit.animations.length > 0) {
        let finished = pendingExit.animations.every(
          (animation) => animation.playState === 'finished',
        )
        if (finished) return readComputedKeyframe(node, pendingExit.properties)
      }
    }

    let trackedAnimation = animatingNodes.get(node)
    if (!trackedAnimation) return
    let running = trackedAnimation.animations.some((animation) => animation.playState === 'running')
    if (!running) return

    // WAAPI can throw InvalidStateError here if the target is transiently non-rendered
    // during reclaim; we still have computed-style fallback below for retargeting.
    for (let animation of trackedAnimation.animations) {
      try {
        animation.commitStyles()
      } catch {}
    }
    if (pendingExit) {
      pendingExit.cancel()
    } else {
      for (let animation of trackedAnimation.animations) animation.cancel()
    }

    let style = (node as HTMLElement).style
    let computed = getComputedStyle(node)
    let startingKeyframe: Keyframe = {}
    for (let property of trackedAnimation.properties) {
      let cssProperty = toCssPropertyName(property)
      let value = readInlineStyle(style, property) || computed.getPropertyValue(cssProperty)
      if (value !== '') {
        startingKeyframe[property as keyof Keyframe] = value
      }
      writeInlineStyle(style, property, '')
    }
    return startingKeyframe
  } finally {
    pendingExit?.cancel()
  }
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
      if (current && current.animations.some((animation) => animation.playState === 'running')) {
        return
      }

      let config = resolveEnterConfig(currentConfig)
      if (!config) return
      if (shouldSkipInitialEntrance(event, config)) return
      let keyframes = buildEnterKeyframes(config)
      startAnimation(node, keyframes, config, 'backwards')
    })

    return (config) => {
      currentConfig = config
      return handle.element
    }
  },
  { ssr: false },
)

const animateExitMixin = createMixin<Element, [config: AnimationConfig], ElementProps>(
  (handle) => {
    let currentConfig: AnimationConfig = true
    let node: Element | null = null
    let pendingExit: PendingExitAnimation | undefined

    handle.addEventListener('insert', (event) => {
      node = event.node
    })

    handle.addEventListener('reclaimed', (event) => {
      node = event.node
      let startingKeyframe = prepareReclaimedElement(node, pendingExit)
      pendingExit = undefined
      if (!startingKeyframe) return

      let enterConfig = resolveEnterConfig(currentConfig) ?? DEFAULT_ENTER
      let keyframes: Keyframe[] = [startingKeyframe, {}]
      startAnimation(node, keyframes, enterConfig, 'none')
    })

    handle.addEventListener('beforeRemove', (event) => {
      let config = resolveExitConfig(currentConfig)
      if (!config || !node) return
      // Teardown can request removal again before the previous exit is reclaimed.
      pendingExit?.cancel()
      let exit: PendingExitAnimation
      try {
        exit = createPendingExitAnimation(node, config)
      } catch (error) {
        // Preserve persistence callback error handling when native animation setup fails.
        event.persistNode(() => {
          throw error
        })
        return
      }

      pendingExit = exit
      event.persistNode((signal) => exit.waitForFinish(signal))
    })

    handle.addEventListener('remove', () => {
      pendingExit?.cancel()
      pendingExit = undefined
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
 *
 * @param config Exit animation configuration.
 * @returns A mixin descriptor for the target element.
 */
export function animateExit<target extends EventTarget = Element>(
  config: AnimationConfig = true,
): MixinDescriptor<target, [AnimationConfig], ElementProps> {
  return animateExitMixin(config) as unknown as MixinDescriptor<
    target,
    [AnimationConfig],
    ElementProps
  >
}
