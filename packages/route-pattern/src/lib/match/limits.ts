/** Resource limits applied while compiling and matching route patterns. */
export interface MatcherLimits {
  /** Maximum UTF-8 byte length of one normalized pattern source. */
  maxPatternSourceBytes: number

  /** Maximum combined UTF-8 byte length of all patterns in one matcher. */
  maxMatcherSourceBytes: number

  /** Maximum combined compiled states in one matcher. */
  maxCompiledStates: number

  /** Maximum state and input-position combinations evaluated by one part match. */
  maxActiveStates: number

  /** Maximum combined capture declarations in one matcher. */
  maxCaptureMetadata: number
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
  maxPatternSourceBytes: 64 * 1024,
  maxMatcherSourceBytes: 16 * 1024 * 1024,
  maxCompiledStates: 1_000_000,
  maxActiveStates: 1_000_000,
  maxCaptureMetadata: 100_000,
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
