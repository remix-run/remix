export interface HoverAim {
  start(target: HTMLElement, event?: PointerEvent, onExpire?: () => void): boolean
  accepts(event: PointerEvent): boolean
}

type Point = {
  x: number
  y: number
}

type Rect = {
  left: number
  top: number
  right: number
  bottom: number
}

type Session = {
  target: HTMLElement
  actualRect: Rect
  polygon: Point[]
  startedAt: number
  lastDistance: number
  lastPoint: Point
  durationTimeoutId: number
  stalledUpdates: number
  stallTimeoutId: number
  onExpire?: () => void
}

const HOVER_AIM_PADDING = 8
const HOVER_AIM_MAX_DURATION = 300
const HOVER_AIM_STALL_DURATION = 120
const HOVER_AIM_MIN_PROGRESS = 0.5
const HOVER_AIM_MAX_STALLED_UPDATES = 2

export function createHoverAim(): HoverAim {
  let lastPointer: Point | null = null
  let session: Session | null = null

  function clearSession(reason: string, currentSession: Session | null = session) {
    if (!currentSession) {
      return
    }

    clearTimeout(currentSession.durationTimeoutId)
    clearTimeout(currentSession.stallTimeoutId)

    if (session === currentSession) {
      session = null
    }

    if (reason === 'duration-timeout' || reason === 'stall-timeout') {
      currentSession.onExpire?.()
    }
  }

  function scheduleDurationTimeout(currentSession: Session) {
    currentSession.durationTimeoutId = window.setTimeout(() => {
      clearSession('duration-timeout', currentSession)
    }, HOVER_AIM_MAX_DURATION)
  }

  function scheduleStallTimeout(currentSession: Session) {
    clearTimeout(currentSession.stallTimeoutId)
    currentSession.stallTimeoutId = window.setTimeout(() => {
      clearSession('stall-timeout', currentSession)
    }, HOVER_AIM_STALL_DURATION)
  }

  function rememberPointer(event: PointerEvent) {
    if (!isMousePointer(event)) {
      return
    }

    lastPointer = getPoint(event)
  }

  function start(target: HTMLElement, event?: PointerEvent, onExpire?: () => void) {
    clearSession('restart')

    if (event && !isMousePointer(event)) {
      return false
    }

    if (!target.isConnected) {
      return false
    }

    let startPoint = event ? getPoint(event) : lastPointer
    if (!startPoint) {
      return false
    }

    let actualRect = toRect(target.getBoundingClientRect())
    if (isEmptyRect(actualRect) || containsPoint(actualRect, startPoint)) {
      return false
    }

    lastPointer = startPoint

    let paddedRect = inflateRect(actualRect, HOVER_AIM_PADDING)
    let currentSession: Session = {
      target,
      actualRect,
      polygon: createCorridor(startPoint, paddedRect),
      startedAt: Date.now(),
      lastDistance: distanceToRect(startPoint, actualRect),
      lastPoint: startPoint,
      durationTimeoutId: 0,
      stalledUpdates: 0,
      stallTimeoutId: 0,
      onExpire,
    }

    session = currentSession
    scheduleDurationTimeout(currentSession)
    scheduleStallTimeout(currentSession)
    return true
  }

  function accepts(event: PointerEvent) {
    rememberPointer(event)

    let currentSession = session
    if (!currentSession) {
      return true
    }

    if (!isMousePointer(event) || event.type !== 'pointermove') {
      clearSession('non-pointermove', currentSession)
      return true
    }

    if (!currentSession.target.isConnected) {
      clearSession('target-disconnected', currentSession)
      return true
    }

    let point = getPoint(event)
    if (enteredTarget(currentSession, point, event.target)) {
      clearSession('entered-target', currentSession)
      return true
    }

    if (!pointInPolygon(point, currentSession.polygon)) {
      clearSession('outside-corridor', currentSession)
      return true
    }

    if (distanceBetweenPoints(currentSession.lastPoint, point) > 0) {
      scheduleStallTimeout(currentSession)
    }

    let nextDistance = distanceToRect(point, currentSession.actualRect)
    if (currentSession.lastDistance - nextDistance >= HOVER_AIM_MIN_PROGRESS) {
      currentSession.stalledUpdates = 0
    } else {
      currentSession.stalledUpdates++
    }

    currentSession.lastPoint = point
    currentSession.lastDistance = nextDistance

    if (currentSession.stalledUpdates >= HOVER_AIM_MAX_STALLED_UPDATES) {
      clearSession('stalled-updates', currentSession)
      return true
    }

    if (Date.now() - currentSession.startedAt >= HOVER_AIM_MAX_DURATION) {
      clearSession('max-duration', currentSession)
      return true
    }

    return false
  }
  return { start, accepts }
}

function isMousePointer(event: PointerEvent) {
  return (
    event.pointerType === undefined || event.pointerType === '' || event.pointerType === 'mouse'
  )
}

function getPoint(event: PointerEvent): Point {
  return {
    x: event.clientX,
    y: event.clientY,
  }
}

function toRect(rect: DOMRectReadOnly): Rect {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
  }
}

function isEmptyRect(rect: Rect) {
  return rect.left === rect.right || rect.top === rect.bottom
}

function inflateRect(rect: Rect, padding: number): Rect {
  return {
    left: rect.left - padding,
    top: rect.top - padding,
    right: rect.right + padding,
    bottom: rect.bottom + padding,
  }
}

function containsPoint(rect: Rect, point: Point) {
  return (
    point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom
  )
}

function enteredTarget(session: Session, point: Point, eventTarget: EventTarget | null) {
  if (containsPoint(session.actualRect, point)) {
    return true
  }

  return eventTarget instanceof Node && session.target.contains(eventTarget)
}

function distanceBetweenPoints(from: Point, to: Point) {
  return Math.hypot(to.x - from.x, to.y - from.y)
}

function distanceToRect(point: Point, rect: Rect) {
  let dx = 0
  let dy = 0

  if (point.x < rect.left) {
    dx = rect.left - point.x
  } else if (point.x > rect.right) {
    dx = point.x - rect.right
  }

  if (point.y < rect.top) {
    dy = rect.top - point.y
  } else if (point.y > rect.bottom) {
    dy = point.y - rect.bottom
  }

  return Math.hypot(dx, dy)
}

function createCorridor(startPoint: Point, rect: Rect) {
  let points = dedupePoints([
    startPoint,
    { x: rect.left, y: rect.top },
    { x: rect.right, y: rect.top },
    { x: rect.right, y: rect.bottom },
    { x: rect.left, y: rect.bottom },
  ])

  if (points.length <= 2) {
    return points
  }

  points.sort((left, right) => {
    if (left.x === right.x) {
      return left.y - right.y
    }

    return left.x - right.x
  })

  let lower: Point[] = []
  for (let point of points) {
    while (
      lower.length >= 2 &&
      crossProduct(lower[lower.length - 2], lower[lower.length - 1], point) <= 0
    ) {
      lower.pop()
    }
    lower.push(point)
  }

  let upper: Point[] = []
  for (let index = points.length - 1; index >= 0; index--) {
    let point = points[index]
    while (
      upper.length >= 2 &&
      crossProduct(upper[upper.length - 2], upper[upper.length - 1], point) <= 0
    ) {
      upper.pop()
    }
    upper.push(point)
  }

  return lower.slice(0, -1).concat(upper.slice(0, -1))
}

function crossProduct(origin: Point, a: Point, b: Point) {
  return (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x)
}

function dedupePoints(points: Point[]) {
  let seen = new Set<string>()
  return points.filter((point) => {
    let key = `${point.x}:${point.y}`
    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function pointInPolygon(point: Point, polygon: Point[]) {
  if (polygon.length < 3) {
    return false
  }

  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    if (pointOnSegment(point, polygon[j], polygon[i])) {
      return true
    }

    if (
      polygon[i].y > point.y !== polygon[j].y > point.y &&
      point.x <
        ((polygon[j].x - polygon[i].x) * (point.y - polygon[i].y)) / (polygon[j].y - polygon[i].y) +
          polygon[i].x
    ) {
      inside = !inside
    }
  }

  return inside
}

function pointOnSegment(point: Point, start: Point, end: Point) {
  let cross = crossProduct(start, end, point)
  if (Math.abs(cross) > 0.001) {
    return false
  }

  return (
    point.x >= Math.min(start.x, end.x) &&
    point.x <= Math.max(start.x, end.x) &&
    point.y >= Math.min(start.y, end.y) &&
    point.y <= Math.max(start.y, end.y)
  )
}
