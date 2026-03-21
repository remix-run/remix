/**
 * Sort direction accepted by `orderBy`.
 */
export type OrderDirection = 'asc' | 'desc'

/**
 * Normalized `orderBy` clause.
 */
export type OrderByClause = {
  column: string
  direction: OrderDirection
}
