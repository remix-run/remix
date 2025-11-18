/**
 * Use this when framework code is incorrect, indicating an internal bug rather
 * than application code error.
 */
export function invariant(assertion: any, message?: string): asserts assertion {
  let prefix = 'Framework invariant'
  if (assertion) return
  throw new Error(message ? `${prefix}: ${message}` : prefix)
}

/**
 * Use this when application logic is incorrect, indicating a developer error.
 *
 * Using ID-based warnings with external documentation links allows us to:
 * - Update warning messages without releasing new versions
 * - Avoid bloating the library with warning messages or complicating builds
 *   with prod/dev build/export shenanigans
 * - Provide detailed troubleshooting guides and examples
 *
 * `id` is first so we can easily grep the codebase for ensure calls
 */
export function ensure(id: number, assertion: boolean): asserts assertion {
  if (assertion) return
  throw new Error(`REMIX_${id}: https://rmx.as/w/${id}`)
}
