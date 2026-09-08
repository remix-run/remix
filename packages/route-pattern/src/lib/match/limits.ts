/** Resource limits applied while compiling and matching route patterns. */
export interface MatcherLimits {
  /** Maximum size of one pattern, measured in UTF-8 bytes. Defaults to 65,536. */
  maxPatternSize: number

  /** Maximum combined size of all patterns, measured in UTF-8 bytes. Defaults to 16,777,216. */
  maxMatcherSize: number

  /** Maximum aggregate work performed by one URL match. Defaults to 1,000,000. */
  maxMatchWork: number
}

/** Structured details describing a matcher resource-limit failure. */
export interface MatcherResourceErrorDetails {
  /** Limit that was exceeded. */
  limit: keyof MatcherLimits

  /** Configured maximum value. */
  maximum: number

  /** Value requested by the failed operation. */
  actual: number
}

/** Error thrown when matcher compilation or matching exceeds a configured resource limit. */
export class MatcherResourceError extends Error {
  /** Structured information about the exceeded limit. */
  details: MatcherResourceErrorDetails

  /**
   * Creates a matcher resource error.
   *
   * @param details Information about the exceeded limit.
   */
  constructor(details: MatcherResourceErrorDetails) {
    super(`${details.limit} exceeded: ${details.actual} > ${details.maximum}`)
    this.name = 'MatcherResourceError'
    this.details = details
  }
}

const defaultMatcherLimits: MatcherLimits = {
  maxPatternSize: 64 * 1024,
  maxMatcherSize: 16 * 1024 * 1024,
  maxMatchWork: 1_000_000,
}

export type MatchWorkBudget = {
  readonly maximum: number
  actual: number
}

export function createMatchWorkBudget(maximum: number): MatchWorkBudget {
  return { maximum, actual: 0 }
}

export function consumeMatchWork(budget: MatchWorkBudget, count: number): void {
  let actual = budget.actual + count
  if (!Number.isSafeInteger(actual)) actual = Number.MAX_SAFE_INTEGER
  checkMatcherLimit('maxMatchWork', budget.maximum, actual)
  budget.actual = actual
}

export function resolveMatcherLimits(limits?: Partial<MatcherLimits>): MatcherLimits {
  let result = { ...defaultMatcherLimits, ...limits }
  for (let [limit, maximum] of Object.entries(result)) {
    if (!Number.isSafeInteger(maximum) || maximum < 0) {
      throw new RangeError(`${limit} must be a non-negative safe integer`)
    }
  }
  return result
}

export function checkMatcherLimit(
  limit: keyof MatcherLimits,
  maximum: number,
  actual: number,
): void {
  if (actual > maximum) throw new MatcherResourceError({ limit, maximum, actual })
}
