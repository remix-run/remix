/**
 * Layout animation system using FLIP technique with Web Animations API.
 *
 * Based on Motion's projection system:
 * - Box/Axis/Delta data structures for precise layout calculations
 * - Proper FLIP (First, Last, Invert, Play) algorithm
 * - Interruptible animations using WAAPI
 */

// --- Data Structures ---

interface Axis {
  min: number
  max: number
}

interface Box {
  x: Axis
  y: Axis
}

interface AxisDelta {
  translate: number
  scale: number
  origin: number
  originPoint: number
}

interface Delta {
  x: AxisDelta
  y: AxisDelta
}

interface LayoutAnimationConfig {
  duration?: number
  easing?: string
}

// Internal defaults for layout animations
const LAYOUT_DEFAULTS = {
  duration: 200,
  easing: 'ease-out',
}

interface LayoutElement {
  snapshot: Box | null
  config: LayoutAnimationConfig
  animation: Animation | null
  progress: number
  currentDelta: Delta | null
}

// --- Factory Functions ---

function createAxis(): Axis {
  return { min: 0, max: 0 }
}

function createBox(): Box {
  return { x: createAxis(), y: createAxis() }
}

function createAxisDelta(): AxisDelta {
  return { translate: 0, scale: 1, origin: 0.5, originPoint: 0 }
}

function createDelta(): Delta {
  return { x: createAxisDelta(), y: createAxisDelta() }
}

// --- Utility Functions ---

function calcLength(axis: Axis): number {
  return axis.max - axis.min
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

function mix(from: number, to: number, progress: number): number {
  return from + (to - from) * progress
}

function isNear(value: number, target: number, threshold: number): boolean {
  return Math.abs(value - target) <= threshold
}

// Precision thresholds for snapping to identity transforms
const SCALE_PRECISION = 0.0001
const TRANSLATE_PRECISION = 0.01

// --- Delta Calculation ---

// Calculate the delta (translate + scale) needed to transform source axis to target axis.
// For FLIP: source = new position, target = old position, result = transform to invert
function calcAxisDelta(delta: AxisDelta, source: Axis, target: Axis, origin: number = 0.5): void {
  delta.origin = origin
  delta.originPoint = mix(source.min, source.max, origin)

  let sourceLength = calcLength(source)
  let targetLength = calcLength(target)

  delta.scale = sourceLength !== 0 ? targetLength / sourceLength : 1

  let targetOriginPoint = mix(target.min, target.max, origin)
  delta.translate = targetOriginPoint - delta.originPoint

  // Snap to identity if within precision threshold
  if (isNear(delta.scale, 1, SCALE_PRECISION) || isNaN(delta.scale)) {
    delta.scale = 1
  }
  if (isNear(delta.translate, 0, TRANSLATE_PRECISION) || isNaN(delta.translate)) {
    delta.translate = 0
  }
}

function calcBoxDelta(delta: Delta, source: Box, target: Box, originX = 0.5, originY = 0.5): void {
  calcAxisDelta(delta.x, source.x, target.x, originX)
  calcAxisDelta(delta.y, source.y, target.y, originY)
}

// --- Delta Interpolation ---

// Mix axis delta toward identity. At progress=0, output equals input. At progress=1, output is identity.
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

// --- Transform Building ---

function buildProjectionTransform(delta: Delta): string {
  let { x, y } = delta

  let transform = ''

  if (x.translate || y.translate) {
    transform = `translate3d(${x.translate}px, ${y.translate}px, 0)`
  }

  if (x.scale !== 1 || y.scale !== 1) {
    transform += transform ? ' ' : ''
    transform += `scale(${x.scale}, ${y.scale})`
  }

  return transform || 'none'
}

function buildTransformOrigin(delta: Delta): string {
  return `${delta.x.origin * 100}% ${delta.y.origin * 100}%`
}

// --- Bounding Box Conversion ---

function rectToBox(rect: DOMRect): Box {
  return {
    x: { min: rect.left, max: rect.right },
    y: { min: rect.top, max: rect.bottom },
  }
}

function isDeltaZero(delta: Delta): boolean {
  return (
    isNear(delta.x.translate, 0, TRANSLATE_PRECISION) &&
    isNear(delta.y.translate, 0, TRANSLATE_PRECISION) &&
    isNear(delta.x.scale, 1, SCALE_PRECISION) &&
    isNear(delta.y.scale, 1, SCALE_PRECISION)
  )
}

// --- Layout Animation System ---

let layoutElements = new Map<Element, LayoutElement>()

// Track which elements need to be processed in the current flush
let pendingElements = new Set<Element>()

// Mark all layout elements within a DOM subtree as pending
export function markLayoutSubtreePending(root: ParentNode): void {
  for (let el of layoutElements.keys()) {
    if (root.contains(el)) {
      pendingElements.add(el)
    }
  }
}

// Capture layout snapshots BEFORE DOM changes (the "First" step of FLIP)
// Only captures elements that have been marked as pending
export function captureLayoutSnapshots(): void {
  for (let el of pendingElements) {
    let data = layoutElements.get(el)
    if (!data) continue

    let htmlEl = el as HTMLElement

    // Temporarily remove transform to capture the natural layout position
    // This ensures we capture where the element SHOULD be, not where it
    // visually appears due to animation transforms
    let prevTransform = htmlEl.style.transform
    let prevOrigin = htmlEl.style.transformOrigin
    htmlEl.style.transform = 'none'
    htmlEl.style.transformOrigin = ''

    let box = createBox()
    let rect = el.getBoundingClientRect()
    box.x.min = rect.left
    box.x.max = rect.right
    box.y.min = rect.top
    box.y.max = rect.bottom
    data.snapshot = box

    // Restore transform
    htmlEl.style.transform = prevTransform
    htmlEl.style.transformOrigin = prevOrigin
  }
}

// Apply FLIP animations AFTER DOM changes (the "Last, Invert, Play" steps)
// Processes:
// 1. Newly registered elements (snapshot === null) - initialize them
// 2. Pending elements - check for position changes and animate
export function applyLayoutAnimations(): void {
  // First, initialize any newly registered elements
  // These are elements that were just created during this render
  for (let [el, data] of layoutElements) {
    if (data.snapshot === null) {
      let htmlEl = el as HTMLElement
      htmlEl.style.transform = ''
      htmlEl.style.transformOrigin = ''

      let rect = el.getBoundingClientRect()
      data.snapshot = rectToBox(rect)
    }
  }

  // Then, apply animations only for pending elements (those whose component updated)
  for (let el of pendingElements) {
    let data = layoutElements.get(el)
    if (!data) continue

    // "First" - where element was (captured before DOM changes)
    let first = data.snapshot
    if (!first) continue // Skip if no snapshot (shouldn't happen for pending elements)

    let htmlEl = el as HTMLElement

    // "Last" - temporarily remove transform to measure natural layout position
    let prevTransform = htmlEl.style.transform
    let prevOrigin = htmlEl.style.transformOrigin
    htmlEl.style.transform = 'none'
    htmlEl.style.transformOrigin = ''

    let rect = el.getBoundingClientRect()
    let last = rectToBox(rect)

    // Calculate delta: transform needed to make `last` look like `first`
    let targetDelta = createDelta()
    calcBoxDelta(targetDelta, last, first)

    // Handle animation interruption
    if (data.animation && data.animation.playState === 'running') {
      data.animation.cancel()

      // Blend from current visual state if mid-animation
      if (data.currentDelta && data.progress > 0 && data.progress < 1) {
        let visualDelta = createDelta()
        mixDelta(visualDelta, data.currentDelta, data.progress)

        // Compose: new target delta starts from current visual state
        targetDelta.x.translate += visualDelta.x.translate
        targetDelta.y.translate += visualDelta.y.translate
        targetDelta.x.scale *= visualDelta.x.scale
        targetDelta.y.scale *= visualDelta.y.scale
      }
    }

    // Skip if no significant position/size change
    if (isDeltaZero(targetDelta)) {
      htmlEl.style.transform = prevTransform
      htmlEl.style.transformOrigin = prevOrigin
      data.snapshot = last
      continue
    }

    // Store the target delta for potential interruption
    if (!data.currentDelta) {
      data.currentDelta = createDelta()
    }
    copyDeltaInto(data.currentDelta, targetDelta)
    data.progress = 0

    // "Invert" - apply transform to make element appear at old position
    let invertTransform = buildProjectionTransform(targetDelta)
    let transformOrigin = buildTransformOrigin(targetDelta)

    htmlEl.style.transform = invertTransform
    htmlEl.style.transformOrigin = transformOrigin

    // "Play" - animate transform to identity using WAAPI
    let duration = data.config.duration ?? LAYOUT_DEFAULTS.duration
    let easing = data.config.easing ?? LAYOUT_DEFAULTS.easing

    let keyframes: Keyframe[] = [
      { transform: invertTransform, transformOrigin },
      { transform: 'none', transformOrigin },
    ]

    let animation = htmlEl.animate(keyframes, {
      duration,
      easing,
      fill: 'forwards',
    })

    data.animation = animation

    // Track progress for interruption handling
    let startTime = performance.now()
    let progressTracker = () => {
      if (data.animation !== animation) return
      let elapsed = performance.now() - startTime
      data.progress = Math.min(1, elapsed / duration)
      if (data.progress < 1) {
        requestAnimationFrame(progressTracker)
      }
    }
    requestAnimationFrame(progressTracker)

    animation.finished
      .then(() => {
        if (data.animation === animation) {
          htmlEl.style.transform = ''
          htmlEl.style.transformOrigin = ''
          data.animation = null
          data.currentDelta = null
          data.progress = 0
          data.snapshot = rectToBox(el.getBoundingClientRect())
        }
      })
      .catch(() => {
        // Animation was cancelled - handled in the interruption logic
      })
  }

  // Clear pending set after processing
  pendingElements.clear()
}

export function registerLayoutElement(el: Element, config: LayoutAnimationConfig): void {
  layoutElements.set(el, {
    snapshot: null,
    config,
    animation: null,
    progress: 0,
    currentDelta: null,
  })
}

export function updateLayoutElement(el: Element, config: LayoutAnimationConfig): void {
  let data = layoutElements.get(el)
  if (data) {
    data.config = config
  } else {
    registerLayoutElement(el, config)
  }
}

export function unregisterLayoutElement(el: Element): void {
  let data = layoutElements.get(el)
  if (data) {
    if (data.animation) {
      data.animation.cancel()
    }
    let htmlEl = el as HTMLElement
    htmlEl.style.transform = ''
    htmlEl.style.transformOrigin = ''
  }
  layoutElements.delete(el)
}
