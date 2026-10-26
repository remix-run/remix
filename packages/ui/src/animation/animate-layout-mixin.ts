import { createMixin } from '@remix-run/component'
import type { ElementProps, LayoutAnimationConfig, MixinDescriptor } from '@remix-run/component'

import {
  measureUntransformed,
  measureUntransformedBatch,
  createNativeAnimationPlayback,
  retainAnimationHost,
} from './animation-host.ts'

import { measureCoordinateSpace } from './coordinate-space.ts'

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

function rectToBox(rect: DOMRect): Box {
  return {
    x: { min: rect.left, max: rect.right },
    y: { min: rect.top, max: rect.bottom },
  }
}

function measureNaturalBox(node: HTMLElement): Box {
  return rectToBox(measureUntransformed(node))
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

interface LayoutMeasurement {
  node: HTMLElement
  read(rect: DOMRect): () => void
}
const pendingMeasurements = new WeakMap<
  (task: () => void) => void,
  Map<symbol, LayoutMeasurement>
>()

function flushLayoutMeasurements(pending: Map<symbol, LayoutMeasurement>) {
  let byNode = new Map<HTMLElement, LayoutMeasurement[]>()
  for (let measurement of pending.values()) {
    let group = byNode.get(measurement.node)
    if (group) group.push(measurement)
    else byNode.set(measurement.node, [measurement])
  }
  measureUntransformedBatch(byNode.keys(), (node, rect) => {
    let writes = (byNode.get(node) ?? []).map((measurement) => measurement.read(rect))
    return () => {
      for (let write of writes) write()
    }
  })
}

const animateLayoutMixin = createMixin<Element, [config?: LayoutConfig], ElementProps>(
  (handle) => {
    let snapshot: Box | null = null
    let currentConfig: LayoutConfig = true
    let animations: Animation[] = []
    let releases: Array<() => void> = []
    let registration: ReturnType<typeof retainAnimationHost> | undefined
    let projectionOrigin = 0.5
    let measurementKey = Symbol('layout measurement')
    let cancelMeasurement: (() => void) | undefined

    function attach(node: HTMLElement) {
      registration ??= retainAnimationHost(node)
    }

    function cancel() {
      for (let release of releases) release()
      releases = []
      animations = []
    }

    function projectedBox(node: HTMLElement) {
      let box = measureNaturalBox(node)
      if (!registration) return box
      let space = measureCoordinateSpace(node, false, { left: box.x.min, top: box.y.min })
      let projected = space.toClient({
        x: registration.read('layoutX'),
        y: registration.read('layoutY'),
      })
      for (let axis of ['x', 'y'] as const) {
        let position = projected[axis]
        let scale = registration.read(axis === 'x' ? 'layoutScaleX' : 'layoutScaleY')
        let length = calcLength(box[axis])
        box[axis].min += position + (1 - scale) * projectionOrigin * length
        box[axis].max = box[axis].min + length * scale
      }
      return box
    }
    let animationTarget: Box | null = null

    let clearActiveAnimationState = () => {
      animations = []
      animationTarget = null
    }

    let clearLayoutState = () => {
      clearActiveAnimationState()
      snapshot = null
    }

    let clearProjectionStyles = () => {
      if (!registration) return
      for (let key of ['layoutX', 'layoutY', 'layoutScaleX', 'layoutScaleY'] as const) {
        let claim = registration.claim(key, 'animation')
        claim?.set(key.includes('Scale') ? 1 : 0)
        claim?.release()
      }
      registration.setOrigin(undefined)
    }

    handle.addEventListener('insert', ({ node }) => {
      if (node instanceof HTMLElement) attach(node)
    })

    handle.addEventListener('beforeUpdate', (event) => {
      let layoutConfig = resolveLayoutConfig(currentConfig)
      if (!layoutConfig) return
      let htmlNode = event.node as HTMLElement
      // Capture the live on-screen position so the next animation can pick up
      // where this one was interrupted if this update changes the target box.
      if (
        animations.some(
          (animation) => animation.playState === 'running' || animation.playState === 'paused',
        )
      ) {
        snapshot = projectedBox(htmlNode)
      } else {
        snapshot = measureNaturalBox(htmlNode)
      }
    })

    handle.addEventListener('commit', (event) => {
      let htmlNode = event.node as HTMLElement
      registration ??= retainAnimationHost(htmlNode)
      let layoutConfig = resolveLayoutConfig(currentConfig)
      cancelMeasurement?.()
      let pending = pendingMeasurements.get(event.afterDispatch)
      if (!pending) {
        pending = new Map()
        pendingMeasurements.set(event.afterDispatch, pending)
        let batch = pending
        event.afterDispatch(() => {
          pendingMeasurements.delete(event.afterDispatch)
          flushLayoutMeasurements(batch)
        })
      }
      let batch = pending
      cancelMeasurement = () => batch.delete(measurementKey)
      pending.set(measurementKey, {
        node: htmlNode,
        read(rect) {
          let latest = rectToBox(rect)
          let space = measureCoordinateSpace(htmlNode, false, rect)
          return () => commitProjection(htmlNode, latest, space, layoutConfig)
        },
      })
    })

    function commitProjection(
      htmlNode: HTMLElement,
      latest: Box,
      space: ReturnType<typeof measureCoordinateSpace>,
      layoutConfig: LayoutAnimationConfig | null,
    ) {
      let runningAnimation = animations.some(
        (animation) => animation.playState === 'running' || animation.playState === 'paused',
      )

      if (runningAnimation && animationTarget && layoutConfig) {
        if (isTargetBoxSame(latest, animationTarget, layoutConfig)) {
          snapshot = null
          return
        }
      }

      // Defensive cleanup for cases where beforeUpdate didn't run (e.g. the
      // mixin was just attached, layoutConfig was disabled this render, or an
      // in-flight animation needs to retarget to a new final box).
      cancel()
      clearActiveAnimationState()
      clearProjectionStyles()

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

      let local = space.toLocal({ x: targetDelta.x.translate, y: targetDelta.y.translate })
      targetDelta.x.translate = local.x
      targetDelta.y.translate = local.y
      let remaining = registration?.rebase(targetDelta.x.translate, targetDelta.y.translate)
      if (remaining) {
        targetDelta.x.translate = remaining.x
        targetDelta.y.translate = remaining.y
      }
      projectionOrigin = layoutConfig.size === false ? 0 : 0.5
      registration?.setOrigin(`${projectionOrigin * 100}% ${projectionOrigin * 100}%`)

      let duration = layoutConfig.duration ?? DEFAULT_DURATION
      let easing = layoutConfig.easing ?? DEFAULT_EASING
      let values = {
        layoutX: targetDelta.x.translate,
        layoutY: targetDelta.y.translate,
        layoutScaleX: layoutConfig.size === false ? 1 : targetDelta.x.scale,
        layoutScaleY: layoutConfig.size === false ? 1 : targetDelta.y.scale,
      }
      for (let key of ['layoutX', 'layoutY', 'layoutScaleX', 'layoutScaleY'] as const) {
        let claim = registration?.claim(key, 'animation')
        if (!claim) continue
        let target = key.includes('Scale') ? 1 : 0
        let playback = createNativeAnimationPlayback(htmlNode, key, values[key], target, {
          duration,
          easing,
        })
        claim.start(playback.backend)
        releases.push(() => claim.release())
        animations.push(playback.animation)
      }
      let active = animations
      animationTarget = latest
      snapshot = null
      Promise.allSettled(active.map((animation) => animation.finished))
        .then(() => {
          if (animations !== active) return
          // Release only this projection's playbacks; gesture and presence owners survive.
          cancel()
          clearProjectionStyles()
          clearLayoutState()
        })
        .catch(() => {})
    }

    handle.addEventListener('remove', () => {
      cancelMeasurement?.()
      cancelMeasurement = undefined
      cancel()
      clearLayoutState()
      registration?.setOrigin(undefined)
      registration?.dispose()
      registration = undefined
    })

    return (config = true) => {
      currentConfig = config
      return handle.element
    }
  },
  { ssr: false },
)

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
