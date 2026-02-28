import { createMixin } from '../mixin.ts'
import type { ElementProps } from '../jsx.ts'
import type { MixinDescriptor } from '../mixin.ts'
import { invariant } from '../invariant.ts'

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

export type AnimateMixinConfig = AnimateTiming & AnimateStyleProps

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
  animation: Animation
  properties: string[]
}

let animatingNodes = new WeakMap<Element, AnimationState>()
let initialEntranceSeenByParent = new WeakMap<ParentNode, Set<string>>()

function extractStyleProps(config: AnimateMixinConfig): Keyframe {
  let result: Keyframe = {}
  for (let key in config) {
    if (
      key === 'duration' ||
      key === 'easing' ||
      key === 'delay' ||
      key === 'composite' ||
      key === 'initial'
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

function createAnimationOptions(
  config: AnimateMixinConfig,
  fill: FillMode,
): KeyframeAnimationOptions {
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

function trackAnimation(node: Element, animation: Animation, keyframes: Keyframe[]) {
  let properties = collectAnimatedProperties(keyframes)
  animatingNodes.set(node, { animation, properties })
  animation.finished
    .catch(() => {})
    .finally(() => {
      let current = animatingNodes.get(node)
      if (current?.animation !== animation) return
      animatingNodes.delete(node)
    })
}

function waitForAnimationOrAbort(animation: Animation, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve()
  return new Promise((resolve) => {
    let settled = false
    let settle = () => {
      if (settled) return
      settled = true
      signal.removeEventListener('abort', settle)
      resolve()
    }
    signal.addEventListener('abort', settle, { once: true })
    void animation.finished.catch(() => {}).finally(settle)
  })
}

function shouldSkipInitialEntrance(
  event: { key?: string; parent: ParentNode },
  config: AnimateMixinConfig,
): boolean {
  if (config.initial !== false) return false
  if (event.key == null) return false
  let seenForParent = initialEntranceSeenByParent.get(event.parent)
  if (!seenForParent) {
    seenForParent = new Set<string>()
    initialEntranceSeenByParent.set(event.parent, seenForParent)
  }
  if (seenForParent.has(event.key)) return false
  seenForParent.add(event.key)
  return true
}

let animateEntranceMixin = createMixin<Element, [config: AnimationConfig], ElementProps>(
  (handle) => {
    let currentConfig: AnimationConfig = true

    handle.addEventListener('insert', (event) => {
      let node = event.node
      let current = animatingNodes.get(node)
      if (current && current.animation.playState === 'running') {
        return
      }

      let config = resolveEnterConfig(currentConfig)
      if (!config) return
      if (shouldSkipInitialEntrance(event, config)) return
      let keyframes = buildEnterKeyframes(config)
      let options = createAnimationOptions(config, 'backwards')
      let animation = (node as HTMLElement).animate(keyframes, options)
      trackAnimation(node, animation, keyframes)
    })

    return (config) => {
      currentConfig = config
      return handle.element
    }
  },
)

let animateExitMixin = createMixin<Element, [config: AnimationConfig], ElementProps>((handle) => {
  let currentConfig: AnimationConfig = true
  let node: Element | null = null

  handle.addEventListener('insert', (event) => {
    node = event.node
  })

  handle.addEventListener('reclaimed', (event) => {
    node = event.node
    let current = animatingNodes.get(event.node)
    if (current && current.animation.playState === 'running') {
      // WAAPI can throw InvalidStateError here if the target is transiently non-rendered
      // during reclaim; we still have computed-style fallback below for retargeting.
      try {
        current.animation.commitStyles()
      } catch {}
      current.animation.cancel()

      let style = (event.node as HTMLElement).style
      let computed = getComputedStyle(event.node as Element)
      let from: Keyframe = {}
      for (let property of current.properties) {
        let cssProperty = toCssPropertyName(property)
        let value = readInlineStyle(style, property) || computed.getPropertyValue(cssProperty)
        if (value !== '') {
          from[property as keyof Keyframe] = value
        }
        writeInlineStyle(style, property, '')
      }

      let enterConfig = resolveEnterConfig(currentConfig) ?? DEFAULT_ENTER
      let keyframes: Keyframe[] = [from, {}]
      let options = createAnimationOptions(enterConfig, 'none')
      let animation = (event.node as HTMLElement).animate(keyframes, options)
      trackAnimation(event.node, animation, keyframes)
    }
  })

  handle.addEventListener('beforeRemove', (event) => {
    let config = resolveExitConfig(currentConfig)
    if (!config) return
    event.persistNode(async (signal) => {
      invariant(node)
      let current = animatingNodes.get(node)
      if (current && current.animation.playState === 'running') {
        current.animation.reverse()
        await waitForAnimationOrAbort(current.animation, signal)
        return
      }

      let keyframes = buildExitKeyframes(config)
      let options = createAnimationOptions(config, 'forwards')
      let animation = (node as HTMLElement).animate(keyframes, options)
      trackAnimation(node, animation, keyframes)
      await waitForAnimationOrAbort(animation, signal)
    })
  })

  return (config) => {
    currentConfig = config
    return handle.element
  }
})

export function animateEntrance<target extends EventTarget = Element>(
  config: AnimationConfig = true,
): MixinDescriptor<target, [AnimationConfig], ElementProps> {
  return animateEntranceMixin(config) as unknown as MixinDescriptor<
    target,
    [AnimationConfig],
    ElementProps
  >
}

export function animateExit<target extends EventTarget = Element>(
  config: AnimationConfig = true,
): MixinDescriptor<target, [AnimationConfig], ElementProps> {
  return animateExitMixin(config) as unknown as MixinDescriptor<
    target,
    [AnimationConfig],
    ElementProps
  >
}
