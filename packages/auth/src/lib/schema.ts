/**
 * Schema definition for auth models
 *
 * This schema representation is ORM-agnostic and can be used by
 * external tools to generate Prisma schemas, Drizzle schemas, SQL migrations, etc.
 */

export interface FieldSchema {
  /**
   * The data type of the field
   */
  type: 'string' | 'number' | 'boolean' | 'date'

  /**
   * Whether the field is required (NOT NULL)
   */
  required: boolean

  /**
   * Whether the field should have a unique constraint
   */
  unique?: boolean
}

export interface ModelSchema {
  /**
   * The name of the model
   */
  name: string

  /**
   * The fields in the model
   */
  fields: Record<string, FieldSchema>

  /**
   * Optional indexes for the model
   */
  indexes?: Array<{
    /**
     * The fields to index
     */
    fields: string[]

    /**
     * Whether the index should be unique
     */
    unique?: boolean
  }>
}

export interface AuthSchema {
  /**
   * The models required by the auth configuration
   */
  models: ModelSchema[]
}
