export function invariant(assertion: any, message?: string): asserts assertion {
  let prefix = 'Invariant'
  if (assertion) return
  throw new Error(message ? `${prefix}: ${message}` : prefix)
}
