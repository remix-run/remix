/**
 * Use this when framework code is incorrect, indicating an internal bug rather
 * than application code error.
 *
 * @param assertion The value to check for truthiness
 * @param message Optional message to include in the error
 */
export function invariant(assertion: any, message?: string): asserts assertion {
  let prefix = 'Framework invariant'
  if (assertion) return
  throw new Error(message ? `${prefix}: ${message}` : prefix)
}
