import { createMixin } from '../mixin.ts'
import type { ElementProps } from '../jsx.ts'
import type { MixinDescriptor } from '../mixin.ts'
import type { LayoutAnimationConfig } from '../dom.ts'

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

function calcBoxDelta(delta: Delta, source: Box, target: Box): void {
  calcAxisDelta(delta.x, source.x, target.x, 0.5)
  calcAxisDelta(delta.y, source.y, target.y, 0.5)
}

function mixAxisDelta(output: AxisDelta, delta: AxisDelta, progress: number): void {
  output.translate = mix(delta.translate, 0, progress)
  output.scale = mix(delta.scale, 1, progress)
  output.origin = delta.origin
  output.originPoint = delta.originPoint
}

function mixDelta(output: Delta, delta: Delta, progress: number): void {
  mixAxisDelta(output.x, delta.x, progress)
  mixAxisDelta(output.y, delta.y, progress)
}

function copyAxisDeltaInto(target: AxisDelta, source: AxisDelta): void {
  target.translate = source.translate
  target.scale = source.scale
  target.origin = source.origin
  target.originPoint = source.originPoint
}

function copyDeltaInto(target: Delta, source: Delta): void {
  copyAxisDeltaInto(target.x, source.x)
  copyAxisDeltaInto(target.y, source.y)
}

function isDeltaZero(delta: Delta): boolean {
  return (
    isNear(delta.x.translate, 0, TRANSLATE_PRECISION) &&
    isNear(delta.y.translate, 0, TRANSLATE_PRECISION) &&
    isNear(delta.x.scale, 1, SCALE_PRECISION) &&
    isNear(delta.y.scale, 1, SCALE_PRECISION)
  )
}

function buildProjectionTransform(delta: Delta): string {
  let transform = ''
  if (delta.x.translate || delta.y.translate) {
    transform = `translate3d(${delta.x.translate}px, ${delta.y.translate}px, 0)`
  }
  if (delta.x.scale !== 1 || delta.y.scale !== 1) {
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

let animateLayoutMixin = createMixin<Element, [config?: LayoutConfig], ElementProps>((handle) => {
  let snapshot: Box | null = null
  let currentConfig: LayoutConfig = true
  let currentDelta: Delta | null = null
  let animationProgress = 0
  let animation: Animation | null = null

  let scheduleProgressTracking = (duration: number, active: Animation) => {
    let start = performance.now()
    let tick = () => {
      if (animation !== active) return
      animationProgress = Math.min(1, (performance.now() - start) / duration)
      if (animationProgress < 1) {
        requestAnimationFrame(tick)
      }
    }
    requestAnimationFrame(tick)
  }

  let clearProjectionStyles = (node: HTMLElement) => {
    node.style.transform = ''
    node.style.transformOrigin = ''
  }

  let resetAnimation = () => {
    animation = null
    currentDelta = null
    animationProgress = 0
  }

  handle.addEventListener('beforeUpdate', (event) => {
    let layoutConfig = resolveLayoutConfig(currentConfig)
    if (!layoutConfig) return
    snapshot = measureNaturalBox(event.node as HTMLElement)
  })

  handle.addEventListener('commit', (event) => {
    let layoutConfig = resolveLayoutConfig(currentConfig)
    let htmlNode = event.node as HTMLElement
    let latest = measureNaturalBox(htmlNode)

    if (!layoutConfig) {
      animation?.cancel()
      clearProjectionStyles(htmlNode)
      resetAnimation()
      snapshot = latest
      return
    }

    if (!snapshot) {
      snapshot = latest
      return
    }

    let targetDelta = createDelta()
    calcBoxDelta(targetDelta, latest, snapshot)

    if (isDeltaZero(targetDelta)) {
      snapshot = latest
      return
    }

    if (animation && animation.playState === 'running') {
      animation.cancel()
      if (currentDelta && animationProgress > 0 && animationProgress < 1) {
        let visual = createDelta()
        mixDelta(visual, currentDelta, animationProgress)
        targetDelta.x.translate += visual.x.translate
        targetDelta.y.translate += visual.y.translate
        targetDelta.x.scale *= visual.x.scale
        targetDelta.y.scale *= visual.y.scale
      }
    }

    if (!currentDelta) currentDelta = createDelta()
    copyDeltaInto(currentDelta, targetDelta)
    animationProgress = 0

    let invert = buildProjectionTransform(targetDelta)
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
    scheduleProgressTracking(duration, active)
    active.finished
      .then(() => {
        if (animation !== active) return
        clearProjectionStyles(htmlNode)
        resetAnimation()
        snapshot = rectToBox(htmlNode.getBoundingClientRect())
      })
      .catch(() => {})
  })

  handle.addEventListener('remove', () => {
    animation?.cancel()
    resetAnimation()
    snapshot = null
  })

  return (config = true) => {
    currentConfig = config
    return handle.element
  }
})

export function animateLayout<target extends EventTarget = Element>(
  config: LayoutConfig = true,
): MixinDescriptor<target, [LayoutConfig?], ElementProps> {
  return animateLayoutMixin(config) as unknown as MixinDescriptor<
    target,
    [LayoutConfig?],
    ElementProps
  >
}
