/**
 * Where clause for filtering records in storage queries
 */
export type Where = {
  /**
   * The field to filter on
   */
  field: string

  /**
   * The value to compare against
   */
  value: any

  /**
   * The comparison operator
   * @default 'eq'
   */
  operator?: 'eq' | 'ne' | 'in' | 'contains' | 'gt' | 'gte' | 'lt' | 'lte'

  /**
   * How to combine this clause with the next
   * @default 'AND'
   */
  connector?: 'AND' | 'OR'
}

/**
 * Generic storage interface for auth data
 *
 * Storage adapters implement this interface to provide database access.
 * The auth client uses this interface to perform CRUD operations without
 * being coupled to any specific database or ORM.
 */
export interface Storage {
  /**
   * Find a single record matching the where clause
   */
  findOne<T = any>(options: { model: string; where: Where[] }): Promise<T | null>

  /**
   * Find multiple records matching the where clause
   */
  findMany<T = any>(options: {
    model: string
    where?: Where[]
    limit?: number
    offset?: number
  }): Promise<T[]>

  /**
   * Create a new record
   */
  create<T = any>(options: { model: string; data: Record<string, any> }): Promise<T>

  /**
   * Update a record matching the where clause
   */
  update<T = any>(options: { model: string; where: Where[]; data: Record<string, any> }): Promise<T>

  /**
   * Delete a record matching the where clause
   */
  delete(options: { model: string; where: Where[] }): Promise<void>
}
