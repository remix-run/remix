import { createMixin } from '../runtime/mixins/mixin.ts'
import type { ElementProps } from '../runtime/jsx.ts'
import type { MixinDescriptor } from '../runtime/mixins/mixin.ts'
import type { LayoutAnimationConfig } from '../runtime/dom.ts'

type LayoutConfig = true | false | null | undefined | LayoutAnimationConfig

type Axis = { min: number; max: number }
type Box = { x: Axis; y: Axis }
type AxisDelta = { translate: number; scale: number; origin: number; originPoint: number }
type Delta = { x: AxisDelta; y: AxisDelta }

const DEFAULT_DURATION = 200
const DEFAULT_EASING = 'ease-out'
const SCALE_PRECISION = 0.0001
const TRANSLATE_PRECISION = 0.01

function createAxisDelta(): AxisDelta {
  return { translate: 0, scale: 1, origin: 0.5, originPoint: 0 }
}

function createDelta(): Delta {
  return { x: createAxisDelta(), y: createAxisDelta() }
}

function mix(from: number, to: number, progress: number): number {
  return from + (to - from) * progress
}

function isNear(value: number, target: number, threshold: number): boolean {
  return Math.abs(value - target) <= threshold
}

function calcLength(axis: Axis): number {
  return axis.max - axis.min
}

function calcAxisDelta(delta: AxisDelta, source: Axis, target: Axis, origin: number = 0.5): void {
  delta.origin = origin
  delta.originPoint = mix(source.min, source.max, origin)

  let sourceLength = calcLength(source)
  let targetLength = calcLength(target)
  delta.scale = sourceLength !== 0 ? targetLength / sourceLength : 1

  let targetOriginPoint = mix(target.min, target.max, origin)
  delta.translate = targetOriginPoint - delta.originPoint

  if (isNear(delta.scale, 1, SCALE_PRECISION) || Number.isNaN(delta.scale)) {
    delta.scale = 1
  }
  if (isNear(delta.translate, 0, TRANSLATE_PRECISION) || Number.isNaN(delta.translate)) {
    delta.translate = 0
  }
}

function calcBoxDelta(delta: Delta, source: Box, target: Box, layoutConfig: LayoutAnimationConfig) {
  let origin = layoutConfig.size === false ? 0 : 0.5
  calcAxisDelta(delta.x, source.x, target.x, origin)
  calcAxisDelta(delta.y, source.y, target.y, origin)
}

function buildProjectionTransform(delta: Delta, layoutConfig: LayoutAnimationConfig): string {
  let transform = ''
  if (delta.x.translate || delta.y.translate) {
    transform = `translate3d(${delta.x.translate}px, ${delta.y.translate}px, 0)`
  }
  if (layoutConfig.size !== false && (delta.x.scale !== 1 || delta.y.scale !== 1)) {
    transform += transform ? ' ' : ''
    transform += `scale(${delta.x.scale}, ${delta.y.scale})`
  }
  return transform || 'none'
}

function buildTransformOrigin(delta: Delta): string {
  return `${delta.x.origin * 100}% ${delta.y.origin * 100}%`
}

function rectToBox(rect: DOMRect): Box {
  return {
    x: { min: rect.left, max: rect.right },
    y: { min: rect.top, max: rect.bottom },
  }
}

function measureNaturalBox(node: HTMLElement): Box {
  let prevTransform = node.style.transform
  let prevOrigin = node.style.transformOrigin
  node.style.transform = 'none'
  node.style.transformOrigin = ''
  let rect = node.getBoundingClientRect()
  node.style.transform = prevTransform
  node.style.transformOrigin = prevOrigin
  return rectToBox(rect)
}

function resolveLayoutConfig(config: LayoutConfig): LayoutAnimationConfig | null {
  if (!config) return null
  if (config === true) return {}
  return config
}

function isVisualDeltaZero(delta: Delta, layoutConfig: LayoutAnimationConfig): boolean {
  return (
    isNear(delta.x.translate, 0, TRANSLATE_PRECISION) &&
    isNear(delta.y.translate, 0, TRANSLATE_PRECISION) &&
    (layoutConfig.size === false ||
      (isNear(delta.x.scale, 1, SCALE_PRECISION) && isNear(delta.y.scale, 1, SCALE_PRECISION)))
  )
}

function isTargetBoxSame(source: Box, target: Box, layoutConfig: LayoutAnimationConfig): boolean {
  return (
    isNear(source.x.min, target.x.min, TRANSLATE_PRECISION) &&
    isNear(source.y.min, target.y.min, TRANSLATE_PRECISION) &&
    (layoutConfig.size === false ||
      (isNear(source.x.max, target.x.max, TRANSLATE_PRECISION) &&
        isNear(source.y.max, target.y.max, TRANSLATE_PRECISION)))
  )
}

function measureAnimationTargetBox(
  node: HTMLElement,
  animation: Animation,
  animationEndTime: number,
): Box {
  let currentTime = animation.currentTime
  let wasRunning = animation.playState === 'running'

  animation.currentTime = animationEndTime
  let box = measureNaturalBox(node)
  animation.currentTime = currentTime

  if (wasRunning && animation.playState !== 'running') {
    animation.play()
  }

  return box
}

const animateLayoutMixin = createMixin<Element, [config?: LayoutConfig], ElementProps>((handle) => {
  let snapshot: Box | null = null
  let currentConfig: LayoutConfig = true
  let animation: Animation | null = null
  let animationTarget: Box | null = null
  let animationEndTime = 0

  let clearActiveAnimationState = () => {
    animation = null
    animationTarget = null
    animationEndTime = 0
  }

  let clearLayoutState = () => {
    clearActiveAnimationState()
    snapshot = null
  }

  let clearProjectionStyles = (node: HTMLElement) => {
    node.style.transform = ''
    node.style.transformOrigin = ''
  }

  handle.addEventListener('beforeUpdate', (event) => {
    let layoutConfig = resolveLayoutConfig(currentConfig)
    if (!layoutConfig) return
    let htmlNode = event.node as HTMLElement
    // Capture the live on-screen position so the next animation can pick up
    // where this one was interrupted if this update changes the target box.
    if (animation && animation.playState === 'running') {
      snapshot = rectToBox(htmlNode.getBoundingClientRect())
    } else {
      snapshot = measureNaturalBox(htmlNode)
    }
  })

  handle.addEventListener('commit', (event) => {
    let layoutConfig = resolveLayoutConfig(currentConfig)
    let htmlNode = event.node as HTMLElement
    let runningAnimation = animation?.playState === 'running' ? animation : null
    let latest: Box | null = null

    if (runningAnimation && animationTarget && layoutConfig) {
      latest = measureAnimationTargetBox(htmlNode, runningAnimation, animationEndTime)
      if (isTargetBoxSame(latest, animationTarget, layoutConfig)) {
        snapshot = null
        return
      }
    }

    // Defensive cleanup for cases where beforeUpdate didn't run (e.g. the
    // mixin was just attached, layoutConfig was disabled this render, or an
    // in-flight animation needs to retarget to a new final box).
    animation?.cancel()
    clearActiveAnimationState()
    clearProjectionStyles(htmlNode)
    latest ??= measureNaturalBox(htmlNode)

    if (!layoutConfig) {
      clearLayoutState()
      return
    }

    if (!snapshot) {
      snapshot = null
      return
    }

    let targetDelta = createDelta()
    calcBoxDelta(targetDelta, latest, snapshot, layoutConfig)

    if (isVisualDeltaZero(targetDelta, layoutConfig)) {
      snapshot = null
      return
    }

    let invert = buildProjectionTransform(targetDelta, layoutConfig)
    let origin = buildTransformOrigin(targetDelta)
    htmlNode.style.transform = invert
    htmlNode.style.transformOrigin = origin

    let duration = layoutConfig.duration ?? DEFAULT_DURATION
    let easing = layoutConfig.easing ?? DEFAULT_EASING
    let active = htmlNode.animate(
      [
        { transform: invert, transformOrigin: origin },
        { transform: 'none', transformOrigin: origin },
      ],
      { duration, easing, fill: 'forwards' },
    )
    animation = active
    animationTarget = latest
    animationEndTime = duration
    snapshot = null
    active.finished
      .then(() => {
        if (animation !== active) return
        // Cancel even though the animation finished naturally. A fill:forwards
        // animation in 'finished' state remains an effective animation on
        // transform, which makes commitStyles() throw on the next interrupted
        // animation because more than one effect targets the same property.
        active.cancel()
        clearProjectionStyles(htmlNode)
        clearLayoutState()
      })
      .catch(() => {})
  })

  handle.addEventListener('remove', () => {
    animation?.cancel()
    clearLayoutState()
  })

  return (config = true) => {
    currentConfig = config
    return handle.element
  }
})

/**
 * Animates layout changes for an element using FLIP-style transforms.
 *
 * @param config Layout animation configuration.
 * @returns A mixin descriptor for the target element.
 */
export function animateLayout<target extends EventTarget = Element>(
  config: LayoutConfig = true,
): MixinDescriptor<target, [LayoutConfig?], ElementProps> {
  return animateLayoutMixin(config) as unknown as MixinDescriptor<
    target,
    [LayoutConfig?],
    ElementProps
  >
}
