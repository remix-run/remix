/**
 * Attempt to find the t value for a given x on a cubic bezier curve.
 * Uses Newton-Raphson iteration for fast convergence.
 * @param x1 First control point x coordinate
 * @param x2 Second control point x coordinate
 * @param targetX The x value to solve for
 * @returns The t parameter value
 */
function solveCubicBezierX(x1: number, x2: number, targetX: number): number {
  // Initial guess
  let t = targetX

  // Newton-Raphson iteration (usually converges in 4-8 iterations)
  for (let i = 0; i < 8; i++) {
    let currentX = cubicBezier(t, x1, x2)
    let slope = cubicBezierDerivative(t, x1, x2)

    if (Math.abs(slope) < 1e-6) break

    let error = currentX - targetX
    if (Math.abs(error) < 1e-6) break

    t -= error / slope
  }

  return Math.max(0, Math.min(1, t))
}

/**
 * Compute the value of a cubic bezier at parameter t.
 * For CSS-style beziers, start is (0,0) and end is (1,1),
 * so we only need the two middle control point coordinates.
 * @param t The parameter value (0 to 1)
 * @param p1 First control point coordinate
 * @param p2 Second control point coordinate
 * @returns The bezier value at t
 */
function cubicBezier(t: number, p1: number, p2: number): number {
  // B(t) = 3(1-t)²t·p1 + 3(1-t)t²·p2 + t³
  let oneMinusT = 1 - t
  return 3 * oneMinusT * oneMinusT * t * p1 + 3 * oneMinusT * t * t * p2 + t * t * t
}

/**
 * Derivative of the cubic bezier function.
 * @param t The parameter value (0 to 1)
 * @param p1 First control point coordinate
 * @param p2 Second control point coordinate
 * @returns The derivative of the bezier at t
 */
function cubicBezierDerivative(t: number, p1: number, p2: number): number {
  // B'(t) = 3(1-t)²·p1 + 6(1-t)t·(p2-p1) + 3t²·(1-p2)
  let oneMinusT = 1 - t
  return 3 * oneMinusT * oneMinusT * p1 + 6 * oneMinusT * t * (p2 - p1) + 3 * t * t * (1 - p2)
}

export interface BezierCurve {
  x1: number
  y1: number
  x2: number
  y2: number
}

// Common easing presets
export const easings = {
  linear: { x1: 0, y1: 0, x2: 1, y2: 1 },
  ease: { x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 },
  easeIn: { x1: 0.42, y1: 0, x2: 1, y2: 1 },
  easeOut: { x1: 0, y1: 0, x2: 0.58, y2: 1 },
  easeInOut: { x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
} as const

export interface TweenOptions {
  from: number
  to: number
  duration: number
  curve: BezierCurve
}

/**
 * Generator that tweens a value over time using a cubic bezier curve.
 * Yields the current value on each frame. Use the iterator's `done` property
 * to check if the animation is complete.
 * @param options The tween configuration
 * @yields The current tweened value
 * @returns The final value
 */
export function* tween(options: TweenOptions): Generator<number, number, number> {
  let { from, to, duration, curve } = options
  let { x1, y1, x2, y2 } = curve

  let startTime: number | null = null
  let value = from

  while (true) {
    // Yield current value and receive the next timestamp
    let timestamp: number = yield value

    if (startTime === null) {
      startTime = timestamp
    }

    let elapsed = timestamp - startTime
    let linearProgress = Math.min(elapsed / duration, 1)

    // Map linear progress through the bezier curve
    // x-axis = time, y-axis = value
    let t = solveCubicBezierX(x1, x2, linearProgress)
    let easedProgress = cubicBezier(t, y1, y2)

    value = from + (to - from) * easedProgress

    if (linearProgress >= 1) {
      return to
    }
  }
}
