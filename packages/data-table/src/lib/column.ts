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

  nullable(): ColumnBuilder<output | null> {
    this.#definition.nullable = true
    return this as unknown as ColumnBuilder<output | null>
  }

  notNull(): ColumnBuilder<Exclude<output, null>> {
    this.#definition.nullable = false
    return this as unknown as ColumnBuilder<Exclude<output, null>>
  }

  default(value: unknown): ColumnBuilder<output> {
    this.#definition.default = {
      kind: 'literal',
      value,
    }
    return this
  }

  defaultNow(): ColumnBuilder<output> {
    this.#definition.default = {
      kind: 'now',
    }
    return this
  }

  defaultSql(expression: string): ColumnBuilder<output> {
    this.#definition.default = {
      kind: 'sql',
      expression,
    }
    return this
  }

  primaryKey(): ColumnBuilder<output> {
    this.#definition.primaryKey = true
    return this
  }

  unique(name?: string): ColumnBuilder<output> {
    this.#definition.unique = name ? { name } : true
    return this
  }

  references(table: string, name: string): ColumnBuilder<output>
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

  onDelete(action: ForeignKeyAction): ColumnBuilder<output> {
    if (!this.#definition.references) {
      throw new Error('onDelete() requires references() to be set first')
    }

    this.#definition.references.onDelete = action
    return this
  }

  onUpdate(action: ForeignKeyAction): ColumnBuilder<output> {
    if (!this.#definition.references) {
      throw new Error('onUpdate() requires references() to be set first')
    }

    this.#definition.references.onUpdate = action
    return this
  }

  check(expression: string, name: string): ColumnBuilder<output> {
    let checks = this.#definition.checks ?? []
    checks.push({ expression, name })
    this.#definition.checks = checks
    return this
  }

  comment(text: string): ColumnBuilder<output> {
    this.#definition.comment = text
    return this
  }

  computed(expression: string, options?: { stored?: boolean }): ColumnBuilder<output> {
    this.#definition.computed = {
      expression,
      stored: options?.stored ?? true,
    }
    return this
  }

  unsigned(): ColumnBuilder<output> {
    this.#definition.unsigned = true
    return this
  }

  autoIncrement(): ColumnBuilder<output> {
    this.#definition.autoIncrement = true
    return this
  }

  identity(options?: IdentityOptions): ColumnBuilder<output> {
    this.#definition.identity = options ?? {}
    return this
  }

  collate(name: string): ColumnBuilder<output> {
    this.#definition.collate = name
    return this
  }

  charset(name: string): ColumnBuilder<output> {
    this.#definition.charset = name
    return this
  }

  length(value: number): ColumnBuilder<output> {
    this.#definition.length = value
    return this
  }

  precision(value: number, scale?: number): ColumnBuilder<output> {
    this.#definition.precision = value

    if (scale !== undefined) {
      this.#definition.scale = scale
    }

    return this
  }

  scale(value: number): ColumnBuilder<output> {
    this.#definition.scale = value
    return this
  }

  timezone(enabled = true): ColumnBuilder<output> {
    this.#definition.withTimezone = enabled
    return this
  }

  build(): ColumnDefinition {
    return {
      ...this.#definition,
      checks: this.#definition.checks ? [...this.#definition.checks] : undefined,
    }
  }
}

export type ColumnOutput<column extends ColumnBuilder<any>> =
  column extends ColumnBuilder<infer output> ? output : never

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
  type: ColumnDefinition['type'],
): ColumnBuilder<output> {
  return new ColumnBuilder({ type })
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
export let column: ColumnNamespace = {
  varchar(length: number) {
    return new ColumnBuilder({ type: 'varchar', length })
  },
  text() {
    return createColumnBuilder<string>('text')
  },
  integer() {
    return createColumnBuilder<number>('integer')
  },
  bigint() {
    return createColumnBuilder('bigint')
  },
  decimal(precision: number, scale: number) {
    return new ColumnBuilder({ type: 'decimal', precision, scale })
  },
  boolean() {
    return createColumnBuilder<boolean>('boolean')
  },
  uuid() {
    return createColumnBuilder<string>('uuid')
  },
  date() {
    return createColumnBuilder('date')
  },
  time(options?: { precision?: number; withTimezone?: boolean }) {
    return new ColumnBuilder({
      type: 'time',
      precision: options?.precision,
      withTimezone: options?.withTimezone,
    })
  },
  timestamp(options?: { precision?: number; withTimezone?: boolean }) {
    return new ColumnBuilder({
      type: 'timestamp',
      precision: options?.precision,
      withTimezone: options?.withTimezone,
    })
  },
  json() {
    return createColumnBuilder('json')
  },
  binary(length?: number) {
    return new ColumnBuilder({ type: 'binary', length })
  },
  enum<values extends readonly string[]>(values: values) {
    return new ColumnBuilder({ type: 'enum', enumValues: [...values] }) as ColumnBuilder<
      values[number]
    >
  },
}
