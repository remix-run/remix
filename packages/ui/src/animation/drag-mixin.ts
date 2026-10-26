import { createMixin, css, on } from '@remix-run/component'
import type { Dispatched, ElementProps, MixinDescriptor } from '@remix-run/component'
import { prefersReducedMotion } from './prefers-reduced-motion.ts'
import { frames, springStep } from './drag-physics.ts'
import { retainAnimationHost } from './animation-host.ts'
import { beginPointerSession } from './pointer-session.ts'
import { measureCoordinateSpace, sameCoordinateSpace } from './coordinate-space.ts'

/** A two-dimensional position, offset or velocity. */
interface DragPoint {
  /** Horizontal component, in pixels or pixels per second for velocity. */
  x: number
  /** Vertical component, in pixels or pixels per second for velocity. */
  y: number
}

/** Allowed drag offsets in the element's local coordinate space. Omitted edges are unbounded. */
interface DragBounds {
  /** Minimum horizontal offset in pixels. */
  left?: number
  /** Maximum horizontal offset in pixels. */
  right?: number
  /** Minimum vertical offset in pixels. */
  top?: number
  /** Maximum vertical offset in pixels. */
  bottom?: number
}

const DRAG_START_EVENT = 'rmx:drag-start' as const
const DRAG_EVENT = 'rmx:drag' as const
const DRAG_END_EVENT = 'rmx:drag-end' as const

declare global {
  interface HTMLElementEventMap {
    [DRAG_START_EVENT]: DragStartEvent
    [DRAG_EVENT]: DragEvent
    [DRAG_END_EVENT]: DragEndEvent
  }
  interface DocumentEventMap {
    [DRAG_START_EVENT]: DragStartEvent
    [DRAG_EVENT]: DragEvent
    [DRAG_END_EVENT]: DragEndEvent
  }
  interface WindowEventMap {
    [DRAG_START_EVENT]: DragStartEvent
    [DRAG_EVENT]: DragEvent
    [DRAG_END_EVENT]: DragEndEvent
  }
}

/** Pointer measurements for one recognized drag, independent of the element's visual movement. */
interface DragInfo {
  /** Pointer position in client pixels. */
  readonly point: Readonly<DragPoint>
  /** Pointer displacement since pointer-down, in client pixels, before constraints or elasticity. */
  readonly offset: Readonly<DragPoint>
  /** Movement since the previous pointer sample, in client pixels. */
  readonly delta: Readonly<DragPoint>
  /** Pointer velocity in client pixels per second. */
  readonly velocity: Readonly<DragPoint>
  /** The configured or direction-locked axis, or undefined when both axes are active. */
  readonly axis: 'x' | 'y' | undefined
}

class DragGestureEvent<source extends Event | undefined> extends Event implements DragInfo {
  readonly point: Readonly<DragPoint>
  readonly delta: Readonly<DragPoint>
  readonly offset: Readonly<DragPoint>
  readonly velocity: Readonly<DragPoint>
  readonly axis: 'x' | 'y' | undefined
  readonly sourceEvent: source

  constructor(type: string, info: DragInfo, sourceEvent: source, cancelable = false) {
    super(type, { bubbles: true, cancelable })
    this.point = { ...info.point }
    this.delta = { ...info.delta }
    this.offset = { ...info.offset }
    this.velocity = { ...info.velocity }
    this.axis = info.axis
    this.sourceEvent = sourceEvent
  }
}

/** The first recognized drag movement. Measurements include movement since pointer-down. */
export class DragStartEvent extends DragGestureEvent<PointerEvent> {
  /**
   * Creates a bubbling drag-start notification.
   * @param info Pointer measurements when the gesture is recognized.
   * @param sourceEvent The pointer movement that started dragging.
   */
  constructor(info: DragInfo, sourceEvent: PointerEvent) {
    super(DRAG_START_EVENT, info, sourceEvent)
  }
}

/** Pointer movement during a recognized drag. */
export class DragEvent extends DragGestureEvent<PointerEvent> {
  /**
   * Creates a bubbling drag-movement notification.
   * @param info Pointer measurements for this movement.
   * @param sourceEvent The original pointer movement.
   */
  constructor(info: DragInfo, sourceEvent: PointerEvent) {
    super(DRAG_EVENT, info, sourceEvent)
  }
}

/** Drag completion, before settling. Prevent default on a normal end to retain position. */
export class DragEndEvent extends DragGestureEvent<Event | undefined> {
  /** Whether the gesture ended without a normal release. Cancellation cannot be prevented. */
  readonly cancelled: boolean

  /**
   * Creates a bubbling drag-end event with an independent default action.
   * @param info Final pointer measurements.
   * @param options Cancellation state and the original input event, when available.
   */
  constructor(info: DragInfo, options: { cancelled?: boolean; sourceEvent?: Event } = {}) {
    super(DRAG_END_EVENT, info, options.sourceEvent, !options.cancelled)
    this.cancelled = options.cancelled ?? false
  }
}

/** Pointer dragging, constraints and release behavior for one element. */
export interface DragOptions {
  /** Restrict movement to one axis. Both axes are enabled when omitted. */
  axis?: 'x' | 'y'
  /** Let the initial gesture choose an axis (default: false). */
  directionLock?: boolean
  /**
   * Translation bounds in local pixels, or a resolver returning a containing HTMLElement or bounds.
   * Element bounds track resizing. Larger content can pan within the containing element.
   * Omitted edges or an undefined resolver result leave movement unbounded.
   */
  constraints?: DragBounds | (() => HTMLElement | DragBounds | undefined)
  /** Linear overshoot factor from 0 to 1, optionally per edge (default: 0.2). Zero prevents boundary bounce on release too. */
  elasticity?: number | DragBounds
  /** Continue with release velocity (default: true). */
  momentum?: boolean
  /** Spring back to the origin, within the constraints (default: false). */
  snapToOrigin?: boolean
  /** Stiffness of the origin-return and boundary-return spring (default: 158). */
  stiffness?: number
  /**
   * Damping ratio of the return spring. Below 1 allows oscillation, 1 is critical damping,
   * and above 1 is overdamped. Zero removes damping (default: 1).
   */
  dampingRatio?: number
  /**
   * Exponential momentum decay rate per second. Higher values slow movement faster and shorten travel.
   * Must be finite and positive. Invalid values use the default (default: 2).
   */
  friction?: number
  /** Adjust the projected destination in local pixels, before applying constraints. */
  modifyTarget?: (target: number, axis: 'x' | 'y') => number
}

const activePointers = new WeakMap<Window, Map<number, symbol>>()
const VELOCITY_WINDOW = 80

type AnimationRegistration = ReturnType<typeof retainAnimationHost>
type PositionClaim = NonNullable<ReturnType<AnimationRegistration['claim']>>
const dragMixin = createMixin<HTMLElement, [options: DragOptions], ElementProps>((handle) => {
  let options: DragOptions = {}
  let host: HTMLElement | undefined
  let session: AbortController | undefined
  let cancelSession: (() => void) | undefined
  let registration: AnimationRegistration | undefined
  let xClaim: PositionClaim | undefined
  let yClaim: PositionClaim | undefined
  let x = 0
  let y = 0

  function write() {
    xClaim?.set(x)
    yClaim?.set(y)
  }

  function interrupt() {
    registration?.stop()
    xClaim = undefined
    yClaim = undefined
    x = registration?.read('x') ?? 0
    y = registration?.read('y') ?? 0
  }
  function bounds(space?: ReturnType<typeof measureCoordinateSpace>): DragBounds {
    if (typeof options.constraints !== 'function') return { ...options.constraints }
    let container = options.constraints()
    if (!container || !host) return {}
    if (!(container instanceof HTMLElement)) return { ...container }
    space ??= measureCoordinateSpace(host)
    let outer = measureCoordinateSpace(container, true)
    let minimum = space.toLocal({
      x: outer.origin.x - space.origin.x,
      y: outer.origin.y - space.origin.y,
    })
    let inset = space.toLocal(outer.toClient({ x: container.clientLeft, y: container.clientTop }))
    let size = space.toLocal(
      outer.toClient({ x: container.clientWidth, y: container.clientHeight }),
    )
    let left = minimum.x + inset.x
    let top = minimum.y + inset.y
    let right = left + size.x - host.offsetWidth
    let bottom = top + size.y - host.offsetHeight
    return {
      left: Math.min(left, right),
      right: Math.max(left, right),
      top: Math.min(top, bottom),
      bottom: Math.max(top, bottom),
    }
  }

  let resizeObserver: ResizeObserver | undefined
  let observedContainer: HTMLElement | undefined
  let measuredLimits: DragBounds | undefined

  function observeConstraints() {
    let container = typeof options.constraints === 'function' ? options.constraints() : undefined
    if (!(container instanceof HTMLElement)) container = undefined
    if (container === observedContainer) return
    resizeObserver?.disconnect()
    observedContainer = container
    measuredLimits = container ? bounds() : undefined
    if (!container || !host) return
    resizeObserver = new ResizeObserver(() => {
      let previous = measuredLimits
      let next = bounds()
      measuredLimits = next
      if (!previous || session || !registration) return
      if (
        (['left', 'right', 'top', 'bottom'] as const).every((edge) => previous[edge] === next[edge])
      )
        return
      interrupt()
      for (let axis of ['x', 'y'] as const) {
        let min: keyof DragBounds = axis === 'x' ? 'left' : 'top'
        let max: keyof DragBounds = axis === 'x' ? 'right' : 'bottom'
        let oldMin = previous[min]
        let oldMax = previous[max]
        let newMin = next[min]
        let newMax = next[max]
        if (
          oldMin === undefined ||
          oldMax === undefined ||
          newMin === undefined ||
          newMax === undefined
        )
          continue
        let claim = registration.claim(axis, 'animation')
        if (!claim) continue
        let progress =
          oldMax === oldMin
            ? 0.5
            : Math.max(0, Math.min(1, (claim.read() - oldMin) / (oldMax - oldMin)))
        claim.set(newMin + progress * (newMax - newMin))
        claim.release()
      }
      x = registration.read('x')
      y = registration.read('y')
    })
    resizeObserver.observe(container)
    resizeObserver.observe(host)
  }
  function elasticity(edge: keyof DragBounds) {
    let value = options.elasticity ?? 0.2
    return typeof value === 'number' ? value : (value[edge] ?? 0.2)
  }

  function settle(velocity: DragPoint, cancelled: boolean, limits: DragBounds, axis?: 'x' | 'y') {
    interrupt()
    if (!registration) return
    let settings = options
    function destination(value: number, min?: number, max?: number) {
      return Math.max(min ?? -Infinity, Math.min(max ?? Infinity, value))
    }
    function releaseAxis(name: 'x' | 'y', min?: number, max?: number) {
      if (!registration) return
      let claim = registration.claim(name, 'animation')
      if (!claim) return
      let position = claim.read()
      let speed = options.momentum === false || cancelled ? 0 : velocity[name]
      let hardMin = elasticity(name === 'x' ? 'left' : 'top') === 0
      let hardMax = elasticity(name === 'x' ? 'right' : 'bottom') === 0
      let friction = settings.friction ?? 2
      if (!Number.isFinite(friction) || friction <= 0) friction = 2
      let decayTime = 1 / friction
      let projected = position + speed * decayTime
      let inertiaTarget =
        options.snapToOrigin || cancelled
          ? projected
          : (settings.modifyTarget?.(projected, name) ?? projected)
      // Adjust the inertia curve itself, rather than springing to a snap point.
      if (!options.snapToOrigin && !cancelled && destination(position, min, max) === position)
        speed = (inertiaTarget - position) / decayTime
      let target = options.snapToOrigin
        ? destination(0, min, max)
        : cancelled || destination(position, min, max) !== position
          ? destination(position, min, max)
          : undefined
      if (prefersReducedMotion()) {
        claim.set(target ?? destination(settings.modifyTarget ? inertiaTarget : position, min, max))
        claim.release()
        return
      }
      let complete: (() => void) | undefined
      let finished = new Promise<void>((resolve) => {
        complete = resolve
      })
      let playback = frames((dt) => {
        if (target === undefined && destination(position, min, max) !== position)
          target = destination(position, min, max)
        let decay = Math.exp(-dt / decayTime)
        let next =
          target === undefined
            ? {
                position: inertiaTarget - (inertiaTarget - position) * decay,
                velocity: speed * decay,
              }
            : springStep(position, speed, target, dt, settings)
        if (hardMin && min !== undefined && next.position < min) {
          next.position = min
          next.velocity = Math.max(0, next.velocity)
          target = min
        }
        if (hardMax && max !== undefined && next.position > max) {
          next.position = max
          next.velocity = Math.min(0, next.velocity)
          target = max
        }
        let active =
          Math.abs(next.velocity) + Math.abs(next.position - (target ?? inertiaTarget)) > 0.1
        position = active ? next.position : destination(target ?? inertiaTarget, min, max)
        speed = active ? next.velocity : 0
        claim.set(position)
        if (!active) complete?.()
        return active
      })
      claim.start({
        sample() {
          return position
        },
        stop() {
          playback.stop()
          complete?.()
        },
        pause: playback.pause,
        resume: playback.resume,
        finished,
      })
    }
    if (axis !== 'y') releaseAxis('x', limits.left, limits.right)
    if (axis !== 'x') releaseAxis('y', limits.top, limits.bottom)
  }

  function start(event: PointerEvent) {
    if (!event.isPrimary || event.button !== 0 || session || !host) return
    let node = host
    registration?.pause()
    function takePosition(allowed?: 'x' | 'y') {
      for (let name of ['x', 'y'] as const) {
        if (allowed === (name === 'x' ? 'y' : 'x')) continue
        let projection = registration?.claim(name === 'x' ? 'layoutX' : 'layoutY', 'animation')
        let shift = projection?.read() ?? 0
        projection?.set(0)
        projection?.release()
        if (shift) {
          let claim = registration?.claim(name, 'animation')
          claim?.set(claim.read() + shift)
          claim?.release()
        }
      }
      xClaim =
        allowed === 'y' ? undefined : registration?.claim('x', 'gesture', () => cancelSession?.())
      yClaim =
        allowed === 'x' ? undefined : registration?.claim('y', 'gesture', () => cancelSession?.())
      x = registration?.read('x') ?? 0
      y = registration?.read('y') ?? 0
    }
    x = registration?.read('x') ?? 0
    y = registration?.read('y') ?? 0
    let initial = { x: event.clientX, y: event.clientY, offset: { x: x, y: y } }
    let axis = options.axis
    let offset = { ...initial.offset }
    let velocity = { x: 0, y: 0 }
    let visualVelocity = { x: 0, y: 0 }
    let previous = { x: event.clientX, y: event.clientY, time: event.timeStamp }
    let initialSample = { ...previous, position: { x: x, y: y } }
    let history = [initialSample]
    function velocitySample(time: number) {
      while (history.length > 1 && history[1].time < time - VELOCITY_WINDOW) history.shift()
      let sample = history[0]
      // A hold before movement must not dilute a flick once recent movement samples exist.
      if (
        sample === initialSample &&
        history.length > 1 &&
        time - sample.time > VELOCITY_WINDOW * 2
      )
        sample = history[1]
      return sample
    }
    let space = measureCoordinateSpace(node)
    let pointer = { x: event.clientX, y: event.clientY }
    let grabbed = space.toLocal({ x: pointer.x - space.origin.x, y: pointer.y - space.origin.y })
    grabbed.x -= x
    grabbed.y -= y
    let limits = bounds(space)
    let dragging = false
    let controller = new AbortController()
    let window = node.ownerDocument.defaultView
    if (!window) return
    let owners = activePointers.get(window)
    if (!owners) activePointers.set(window, (owners = new Map()))
    let pointerOwners = owners
    let owner = Symbol('drag gesture')
    let stream = beginPointerSession(event, window)
    session = controller

    function rebase(dx: number, dy: number) {
      if (axis !== 'y' && xClaim) {
        initial.offset.x += dx
        offset.x += dx
        x += dx
        xClaim.set(x)
        for (let sample of history) sample.position.x += dx
      }
      if (axis !== 'x' && yClaim) {
        initial.offset.y += dy
        offset.y += dy
        y += dy
        yClaim.set(y)
        for (let sample of history) sample.position.y += dy
      }
      return { x: axis === 'y' ? dx : 0, y: axis === 'x' ? dy : 0 }
    }
    let removeRebase = registration?.onLayoutRebase((dx, dy) => {
      let remaining = rebase(dx, dy)
      if (axis !== 'y' && xClaim) {
        if (limits.left !== undefined) limits.left += dx
        if (limits.right !== undefined) limits.right += dx
      }
      if (axis !== 'x' && yClaim) {
        if (limits.top !== undefined) limits.top += dy
        if (limits.bottom !== undefined) limits.bottom += dy
      }
      return remaining
    })
    function rawPosition() {
      let point = space.toLocal({ x: pointer.x - space.origin.x, y: pointer.y - space.origin.y })
      return { x: point.x - grabbed.x, y: point.y - grabbed.y }
    }
    function refreshSpace() {
      let next = measureCoordinateSpace(node)
      if (typeof options.constraints === 'function') limits = bounds(next)
      if (sameCoordinateSpace(space, next)) return
      space = next
      let nextOffset = rawPosition()
      rebase(nextOffset.x - offset.x, nextOffset.y - offset.y)
    }
    let geometryFrame = requestAnimationFrame(function measure() {
      if (controller.signal.aborted) return
      if (dragging && node.isConnected) refreshSpace()
      geometryFrame = requestAnimationFrame(measure)
    })
    function release(cancelled: boolean, sourceEvent?: Event, settling = true) {
      let time = sourceEvent?.timeStamp ?? performance.now()
      if (dragging && node.isConnected) refreshSpace()
      if (pointerOwners.get(event.pointerId) === owner) pointerOwners.delete(event.pointerId)
      cancelAnimationFrame(geometryFrame)
      removeRebase?.()
      controller.abort()
      stream.dispose()
      session = undefined
      cancelSession = undefined
      node.removeAttribute('data-dragging')
      node.removeAttribute('data-drag-axis')
      xClaim?.release()
      yClaim?.release()
      xClaim = undefined
      yClaim = undefined
      if (!dragging) {
        if (settling) registration?.resume()
        return
      }
      if (time - previous.time > 100) {
        velocity = { x: 0, y: 0 }
        visualVelocity = { x: 0, y: 0 }
      }
      let point =
        !cancelled && sourceEvent instanceof PointerEvent && sourceEvent.type === 'pointerup'
          ? { x: sourceEvent.clientX, y: sourceEvent.clientY }
          : pointer
      let delta = { x: point.x - previous.x, y: point.y - previous.y }
      if (delta.x || delta.y) {
        let sample = velocitySample(time)
        let seconds = Math.max((time - sample.time) / 1000, 0.001)
        velocity = { x: (point.x - sample.x) / seconds, y: (point.y - sample.y) / seconds }
      }
      let endEvent = new DragEndEvent(
        {
          point,
          delta,
          offset: { x: point.x - initial.x, y: point.y - initial.y },
          velocity,
          axis,
        },
        { cancelled, sourceEvent },
      )
      node.dispatchEvent(endEvent)
      if (settling && (cancelled || !endEvent.defaultPrevented))
        settle(visualVelocity, cancelled, limits, axis)
    }
    cancelSession = () => release(true, undefined, false)
    function movePointer(move: PointerEvent) {
      if (move.pointerId !== event.pointerId) return
      refreshSpace()
      pointer = { x: move.clientX, y: move.clientY }
      let delta = space.toLocal({ x: move.clientX - initial.x, y: move.clientY - initial.y })
      let dx = delta.x
      let dy = delta.y
      let justStarted = false
      if (!dragging) {
        if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return
        if (
          (axis === 'x' && Math.abs(dy) > Math.abs(dx)) ||
          (axis === 'y' && Math.abs(dx) > Math.abs(dy))
        ) {
          release(true)
          return
        }
        if (pointerOwners.has(event.pointerId)) {
          release(true)
          return
        }
        pointerOwners.set(event.pointerId, owner)
        if (options.directionLock && !axis) axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'
        let before = { x, y }
        interrupt()
        takePosition(axis)
        grabbed.x -= x - before.x
        grabbed.y -= y - before.y
        initial.offset = { x, y }
        offset = { x, y }
        dragging = true
        justStarted = true
        stream.capture(node)
        node.setAttribute('data-dragging', '')
        if (axis) node.setAttribute('data-drag-axis', axis)
      }
      move.preventDefault()
      let raw = rawPosition()
      offset = {
        x: axis === 'y' ? initial.offset.x : raw.x,
        y: axis === 'x' ? initial.offset.y : raw.y,
      }
      let sample = velocitySample(move.timeStamp)
      let seconds = Math.max((move.timeStamp - sample.time) / 1000, 0.001)
      velocity = {
        x: (move.clientX - sample.x) / seconds,
        y: (move.clientY - sample.y) / seconds,
      }
      function resist(
        value: number,
        min: number | undefined,
        max: number | undefined,
        lower: keyof DragBounds,
        upper: keyof DragBounds,
      ) {
        let edge =
          min !== undefined && value < min
            ? min
            : max !== undefined && value > max
              ? max
              : undefined
        if (edge === undefined) return value
        let distance = value - edge
        return edge + distance * elasticity(distance < 0 ? lower : upper)
      }
      x = resist(offset.x, limits.left, limits.right, 'left', 'right')
      y = resist(offset.y, limits.top, limits.bottom, 'top', 'bottom')
      write()
      visualVelocity = {
        x: (x - sample.position.x) / seconds,
        y: (y - sample.position.y) / seconds,
      }
      history.push({
        x: move.clientX,
        y: move.clientY,
        time: move.timeStamp,
        position: { x: x, y: y },
      })
      let info = {
        point: { x: move.clientX, y: move.clientY },
        offset: { x: move.clientX - initial.x, y: move.clientY - initial.y },
        delta: { x: move.clientX - previous.x, y: move.clientY - previous.y },
        velocity,
        axis,
      }
      previous = { x: move.clientX, y: move.clientY, time: move.timeStamp }
      if (justStarted) node.dispatchEvent(new DragStartEvent(info, move))
      if (!controller.signal.aborted) node.dispatchEvent(new DragEvent(info, move))
    }
    stream.attach({
      move: movePointer,
      end(up, cancelled) {
        release(cancelled, up)
      },
    })
  }

  handle.addEventListener('insert', ({ node }) => {
    host = node
    registration ??= retainAnimationHost(node)
    x = registration.read('x')
    y = registration.read('y')
    handle.queueTask(observeConstraints)
  })
  handle.addEventListener('commit', () => {
    handle.queueTask(observeConstraints)
  })
  handle.addEventListener('beforeRemove', () => {
    cancelSession?.()
    interrupt()
  })
  handle.addEventListener('reclaimed', () => {
    interrupt()
    for (let axis of ['x', 'y'] as const) {
      let claim = registration?.claim(axis, 'animation')
      claim?.set(0)
      claim?.release()
    }
  })
  handle.addEventListener('remove', () => {
    resizeObserver?.disconnect()
    cancelSession?.()
    interrupt()
    registration?.dispose()
    registration = undefined
    host = undefined
  })
  return (nextOptions) => {
    options = nextOptions ?? {}
    return [
      css({
        touchAction: options.axis === 'x' ? 'pan-y' : options.axis === 'y' ? 'pan-x' : 'none',
        userSelect: 'none',
      }),
      on('dragstart', (event) => event.preventDefault()),
      on('pointerdown', (event) => {
        if (event.target instanceof Element) {
          let control = event.target.closest(
            'button, a, input, textarea, select, [contenteditable], [data-drag-ignore]',
          )
          if (control && control !== host && host?.contains(control)) return
        }
        start(event)
      }),
    ]
  }
})

/**
 * Adds pointer dragging, optional constraints and release animation to an element.
 * Active axes take over position playback; layout changes preserve the held position.
 *
 * @param options Gesture constraints and release settings.
 * @returns A mixin for the draggable element.
 */
export function drag(
  options: DragOptions = {},
): MixinDescriptor<HTMLElement, [DragOptions], ElementProps> {
  return dragMixin(options)
}

type DragEventHandler<event extends Event, target extends HTMLElement> = (
  event: Dispatched<event, target>,
  signal: AbortSignal,
) => void | Promise<void>

/**
 * Listens for recognized drags starting on this element or a descendant.
 * @param handler Handles the bubbling drag-start event and handler cancellation signal.
 * @param captureBoolean Whether to listen during capture (default: false).
 * @returns An event-listener mixin.
 */
export function onDragStart<target extends HTMLElement>(
  handler: DragEventHandler<DragStartEvent, target>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof DRAG_START_EVENT>> {
  return on(DRAG_START_EVENT, handler, captureBoolean)
}

/**
 * Listens for pointer movement during drags on this element or a descendant.
 * @param handler Handles the bubbling drag event and handler cancellation signal.
 * @param captureBoolean Whether to listen during capture (default: false).
 * @returns An event-listener mixin.
 */
export function onDrag<target extends HTMLElement>(
  handler: DragEventHandler<DragEvent, target>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof DRAG_EVENT>> {
  return on(DRAG_EVENT, handler, captureBoolean)
}

/**
 * Listens for drags ending before settling. Prevent default synchronously to retain position.
 * @param handler Handles the bubbling drag-end event and handler cancellation signal.
 * @param captureBoolean Whether to listen during capture (default: false).
 * @returns An event-listener mixin.
 */
export function onDragEnd<target extends HTMLElement>(
  handler: DragEventHandler<DragEndEvent, target>,
  captureBoolean?: boolean,
): ReturnType<typeof on<target, typeof DRAG_END_EVENT>> {
  return on(DRAG_END_EVENT, handler, captureBoolean)
}
