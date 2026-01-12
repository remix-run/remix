import type { PartPattern } from '../part-pattern'

export type AST = {
  protocol: PartPattern
  hostname: PartPattern
  port: string | null
  pathname: PartPattern

  /**
   * - `null`: key must be present
   * - Empty `Set`: key must be present with a value
   * - Non-empty `Set`: key must be present with all these values
   *
   * ```ts
   * new Map([['q', null]])                // -> ?q, ?q=, ?q=1
   * new Map([['q', new Set()]])           // -> ?q=1
   * new Map([['q', new Set(['x', 'y'])]]) // -> ?q=x&q=y
   * ```
   */
  search: Map<string, Set<string> | null>
}
