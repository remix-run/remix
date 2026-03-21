import type { ColumnDefinition, ForeignKeyAction, IdentityOptions } from './adapter.ts'
import { toTableRef } from './migrations/helpers.ts'

/**
 * Chainable builder used to describe physical column definitions.
 */
export class ColumnBuilder<output = unknown> {
  #definition: ColumnDefinition

  constructor(definition: ColumnDefinition) {
    this.#definition = definition
  }

  /**
   * Marks the column as nullable.
   * @returns The column builder with `null` added to its output type.
   */
  nullable(): ColumnBuilder<output | null> {
    this.#definition.nullable = true
    return retypeColumnBuilder<output | null>(this)
  }

  /**
   * Marks the column as non-nullable.
   * @returns The column builder with `null` removed from its output type.
   */
  notNull(): ColumnBuilder<Exclude<output, null>> {
    this.#definition.nullable = false
    return retypeColumnBuilder<Exclude<output, null>>(this)
  }

  /**
   * Sets a literal default value for the column.
   * @param value Default value to apply when the column is omitted.
   * @returns The column builder.
   */
  default(value: unknown): ColumnBuilder<output> {
    this.#definition.default = {
      kind: 'literal',
      value,
    }
    return this
  }

  /**
   * Sets the column default to the current timestamp at write time.
   * @returns The column builder.
   */
  defaultNow(): ColumnBuilder<output> {
    this.#definition.default = {
      kind: 'now',
    }
    return this
  }

  /**
   * Sets a raw SQL expression as the column default.
   * @param expression SQL expression used as the default value.
   * @returns The column builder.
   */
  defaultSql(expression: string): ColumnBuilder<output> {
    this.#definition.default = {
      kind: 'sql',
      expression,
    }
    return this
  }

  /**
   * Marks the column as part of the primary key.
   * @returns The column builder.
   */
  primaryKey(): ColumnBuilder<output> {
    this.#definition.primaryKey = true
    return this
  }

  /**
   * Marks the column as unique.
   * @param name Optional constraint name.
   * @returns The column builder.
   */
  unique(name?: string): ColumnBuilder<output> {
    this.#definition.unique = name ? { name } : true
    return this
  }

  /**
   * Adds a foreign-key reference for the column.
   * @param table Referenced table name.
   * @param name Constraint name.
   * @returns The column builder.
   */
  references(table: string, name: string): ColumnBuilder<output>
  /**
   * Adds a foreign-key reference for the column.
   * @param table Referenced table name.
   * @param columns Referenced column list.
   * @param name Constraint name.
   * @returns The column builder.
   */
  references(table: string, columns: string | string[], name: string): ColumnBuilder<output>
  references(
    table: string,
    columnsOrName: string | string[],
    maybeName?: string,
  ): ColumnBuilder<output> {
    let columns = maybeName === undefined ? 'id' : columnsOrName
    let name = maybeName === undefined ? String(columnsOrName) : maybeName

    this.#definition.references = {
      table: toTableRef(table),
      columns: Array.isArray(columns) ? [...columns] : [columns],
      onDelete: this.#definition.references?.onDelete,
      onUpdate: this.#definition.references?.onUpdate,
      name,
    }
    return this
  }

  /**
   * Sets the foreign-key action used when the referenced row is deleted.
   * @param action Delete action to apply.
   * @returns The column builder.
   */
  onDelete(action: ForeignKeyAction): ColumnBuilder<output> {
    if (!this.#definition.references) {
      throw new Error('onDelete() requires references() to be set first')
    }

    this.#definition.references.onDelete = action
    return this
  }

  /**
   * Sets the foreign-key action used when the referenced row is updated.
   * @param action Update action to apply.
   * @returns The column builder.
   */
  onUpdate(action: ForeignKeyAction): ColumnBuilder<output> {
    if (!this.#definition.references) {
      throw new Error('onUpdate() requires references() to be set first')
    }

    this.#definition.references.onUpdate = action
    return this
  }

  /**
   * Adds a check constraint for the column.
   * @param expression SQL check expression.
   * @param name Constraint name.
   * @returns The column builder.
   */
  check(expression: string, name: string): ColumnBuilder<output> {
    let checks = this.#definition.checks ?? []
    checks.push({ expression, name })
    this.#definition.checks = checks
    return this
  }

  /**
   * Adds a database comment for the column.
   * @param text Comment text.
   * @returns The column builder.
   */
  comment(text: string): ColumnBuilder<output> {
    this.#definition.comment = text
    return this
  }

  /**
   * Marks the column as computed from a SQL expression.
   * @param expression SQL expression for the computed value.
   * @param options Computed-column options.
   * @param options.stored Whether the computed column should be stored instead of virtual.
   * @returns The column builder.
   */
  computed(expression: string, options?: { stored?: boolean }): ColumnBuilder<output> {
    this.#definition.computed = {
      expression,
      stored: options?.stored ?? true,
    }
    return this
  }

  /**
   * Marks the column as unsigned when the dialect supports it.
   * @returns The column builder.
   */
  unsigned(): ColumnBuilder<output> {
    this.#definition.unsigned = true
    return this
  }

  /**
   * Marks the column as auto-incrementing when the dialect supports it.
   * @returns The column builder.
   */
  autoIncrement(): ColumnBuilder<output> {
    this.#definition.autoIncrement = true
    return this
  }

  /**
   * Configures an identity column strategy when the dialect supports it.
   * @param options Identity sequence options.
   * @returns The column builder.
   */
  identity(options?: IdentityOptions): ColumnBuilder<output> {
    this.#definition.identity = options ?? {}
    return this
  }

  /**
   * Sets the collation for the column.
   * @param name Collation name.
   * @returns The column builder.
   */
  collate(name: string): ColumnBuilder<output> {
    this.#definition.collate = name
    return this
  }

  /**
   * Sets the character set for the column.
   * @param name Character set name.
   * @returns The column builder.
   */
  charset(name: string): ColumnBuilder<output> {
    this.#definition.charset = name
    return this
  }

  /**
   * Sets the column length.
   * @param value Maximum length value.
   * @returns The column builder.
   */
  length(value: number): ColumnBuilder<output> {
    this.#definition.length = value
    return this
  }

  /**
   * Sets numeric precision and optional scale for the column.
   * @param value Precision value.
   * @param scale Optional scale value.
   * @returns The column builder.
   */
  precision(value: number, scale?: number): ColumnBuilder<output> {
    this.#definition.precision = value

    if (scale !== undefined) {
      this.#definition.scale = scale
    }

    return this
  }

  /**
   * Sets numeric scale for the column.
   * @param value Scale value.
   * @returns The column builder.
   */
  scale(value: number): ColumnBuilder<output> {
    this.#definition.scale = value
    return this
  }

  /**
   * Enables or disables timezone support for time-based columns.
   * @param enabled Whether timezone support should be enabled.
   * @returns The column builder.
   */
  timezone(enabled = true): ColumnBuilder<output> {
    this.#definition.withTimezone = enabled
    return this
  }

  /**
   * Builds the immutable column definition.
   * @returns A normalized column definition.
   */
  build(): ColumnDefinition {
    return {
      ...this.#definition,
      checks: this.#definition.checks ? [...this.#definition.checks] : undefined,
    }
  }
}

/** Resolves the runtime output type from a column builder. */
export type ColumnOutput<column extends ColumnBuilder<any>> =
  column extends ColumnBuilder<infer output> ? output : never

/** Input type accepted when writing values for a column builder. */
export type ColumnInput<column extends ColumnBuilder<any>> = ColumnOutput<column>

/**
 * Public constructor namespace for column builders.
 */
export type ColumnNamespace = {
  varchar(length: number): ColumnBuilder<string>
  text(): ColumnBuilder<string>
  integer(): ColumnBuilder<number>
  bigint(): ColumnBuilder
  decimal(precision: number, scale: number): ColumnBuilder<number>
  boolean(): ColumnBuilder<boolean>
  uuid(): ColumnBuilder<string>
  date(): ColumnBuilder
  time(options?: { precision?: number; withTimezone?: boolean }): ColumnBuilder
  timestamp(options?: { precision?: number; withTimezone?: boolean }): ColumnBuilder
  json(): ColumnBuilder
  binary(length?: number): ColumnBuilder
  enum<values extends readonly string[]>(values: values): ColumnBuilder<values[number]>
}

function createColumnBuilder<output = unknown>(
  definition: ColumnDefinition,
): ColumnBuilder<output> {
  return new ColumnBuilder(definition)
}

function retypeColumnBuilder<output>(builder: ColumnBuilder<unknown>): ColumnBuilder<output> {
  return builder as ColumnBuilder<output>
}

/**
 * Chainable column builder namespace.
 * @example
 * ```ts
 * import { column as c } from 'remix/data-table'
 *
 * let email = c.varchar(255).notNull().unique('users_email_uq')
 * ```
 */
export const column: ColumnNamespace = {
  varchar(length: number) {
    return createColumnBuilder<string>({ type: 'varchar', length })
  },
  text() {
    return createColumnBuilder<string>({ type: 'text' })
  },
  integer() {
    return createColumnBuilder<number>({ type: 'integer' })
  },
  bigint() {
    return createColumnBuilder({ type: 'bigint' })
  },
  decimal(precision: number, scale: number) {
    return createColumnBuilder<number>({ type: 'decimal', precision, scale })
  },
  boolean() {
    return createColumnBuilder<boolean>({ type: 'boolean' })
  },
  uuid() {
    return createColumnBuilder<string>({ type: 'uuid' })
  },
  date() {
    return createColumnBuilder({ type: 'date' })
  },
  time(options?: { precision?: number; withTimezone?: boolean }) {
    return createColumnBuilder({
      type: 'time',
      precision: options?.precision,
      withTimezone: options?.withTimezone,
    })
  },
  timestamp(options?: { precision?: number; withTimezone?: boolean }) {
    return createColumnBuilder({
      type: 'timestamp',
      precision: options?.precision,
      withTimezone: options?.withTimezone,
    })
  },
  json() {
    return createColumnBuilder({ type: 'json' })
  },
  binary(length?: number) {
    return createColumnBuilder({ type: 'binary', length })
  },
  enum<values extends readonly string[]>(values: values) {
    return createColumnBuilder<values[number]>({ type: 'enum', enumValues: [...values] })
  },
}
