import type { Predicate, WhereInput } from './operators.ts'
import { inferForeignKey } from './inflection.ts'
import { normalizeWhereInput } from './operators.ts'
import { columnMetadataKey, normalizeColumnInput, tableMetadataKey } from './references.ts'
import type { ColumnInput, ColumnReferenceLike, TableMetadataLike } from './references.ts'
import type { Pretty } from './types.ts'

/**
 * Symbol key used to store non-enumerable table metadata.
 */
export { columnMetadataKey, tableMetadataKey } from './references.ts'

/**
 * Minimal Standard Schema-compatible contract used by `data-table`.
 */
export type DataSchema<input = unknown, output = input> = {
  '~standard': {
    version: number
    vendor: string
    validate(
      value: unknown,
      options?: unknown,
    ): { value: output } | { issues: ReadonlyArray<unknown> }
  }
}

/**
 * Mapping of column names to schemas.
 */
export type ColumnSchemas = Record<string, DataSchema<any, any>>

type ColumnNameFromColumns<columns extends ColumnSchemas> = keyof columns & string

type DefaultPrimaryKey<columns extends ColumnSchemas> =
  'id' extends ColumnNameFromColumns<columns>
    ? readonly ['id']
    : readonly ColumnNameFromColumns<columns>[]

type NormalizePrimaryKey<
  columns extends ColumnSchemas,
  primaryKey extends
    | ColumnNameFromColumns<columns>
    | readonly ColumnNameFromColumns<columns>[]
    | undefined,
> = primaryKey extends readonly (infer column extends ColumnNameFromColumns<columns>)[]
  ? readonly [...column[]]
  : primaryKey extends ColumnNameFromColumns<columns>
    ? readonly [primaryKey]
    : DefaultPrimaryKey<columns>

export type TimestampOptions = boolean | { createdAt?: string; updatedAt?: string }

export type TimestampConfig = {
  createdAt: string
  updatedAt: string
}

type TableMetadata<
  name extends string,
  columns extends ColumnSchemas,
  primaryKey extends readonly ColumnNameFromColumns<columns>[],
> = {
  name: name
  columns: columns
  primaryKey: primaryKey
  timestamps: TimestampConfig | null
}

export type ColumnReference<
  tableName extends string,
  columnName extends string,
  schema extends DataSchema<any, any>,
> = ColumnReferenceLike<`${tableName}.${columnName}`> & {
  [columnMetadataKey]: {
    tableName: tableName
    columnName: columnName
    qualifiedName: `${tableName}.${columnName}`
    schema: schema
  }
}

export type AnyColumn = ColumnReference<string, string, DataSchema<any, any>>

export type ColumnReferenceForQualifiedName<qualifiedName extends string> = AnyColumn & {
  [columnMetadataKey]: {
    qualifiedName: qualifiedName
  }
}

type TableColumnReferences<name extends string, columns extends ColumnSchemas> = {
  [column in keyof columns & string]: ColumnReference<name, column, columns[column]>
}

export type Table<
  name extends string,
  columns extends ColumnSchemas,
  primaryKey extends readonly ColumnNameFromColumns<columns>[],
> = TableMetadataLike<name, columns, primaryKey, TimestampConfig | null> & {
  [tableMetadataKey]: TableMetadata<name, columns, primaryKey>
} & TableColumnReferences<name, columns>

export type AnyTable = Table<string, ColumnSchemas, readonly string[]>

export type TableName<table extends AnyTable> = table[typeof tableMetadataKey]['name']

export type TableColumns<table extends AnyTable> = table[typeof tableMetadataKey]['columns']

export type TablePrimaryKey<table extends AnyTable> = table[typeof tableMetadataKey]['primaryKey']

export type TableTimestamps<table extends AnyTable> = table[typeof tableMetadataKey]['timestamps']

export type InferSchemaOutput<schema> =
  schema extends DataSchema<any, infer output> ? output : never

export type TableRow<table extends AnyTable> = Pretty<{
  [column in keyof TableColumns<table> & string]: InferSchemaOutput<TableColumns<table>[column]>
}>

export type TableRowWith<
  table extends AnyTable,
  loaded extends Record<string, unknown> = {},
> = Pretty<TableRow<table> & loaded>

export type TableColumnName<table extends AnyTable> = keyof TableColumns<table> & string

export type QualifiedTableColumnName<table extends AnyTable> =
  `${TableName<table>}.${TableColumnName<table>}`

export type TableColumnInput<table extends AnyTable> = ColumnInput<
  TableColumnName<table> | QualifiedTableColumnName<table>
>

export type TableReference<table extends AnyTable = AnyTable> = {
  kind: 'table'
  name: TableName<table>
  columns: TableColumns<table>
  primaryKey: TablePrimaryKey<table>
  timestamps: TableTimestamps<table>
}

/**
 * Creates a plain table reference snapshot from a table instance.
 * @param table Source table instance.
 * @returns Table metadata snapshot.
 */
export function getTableReference<table extends AnyTable>(table: table): TableReference<table> {
  let metadata = table[tableMetadataKey]

  return {
    kind: 'table',
    name: metadata.name as TableName<table>,
    columns: metadata.columns as TableColumns<table>,
    primaryKey: metadata.primaryKey as TablePrimaryKey<table>,
    timestamps: metadata.timestamps as TableTimestamps<table>,
  }
}

/**
 * Returns a table's SQL name.
 * @param table Source table instance.
 * @returns Table SQL name.
 */
export function getTableName<table extends AnyTable>(table: table): TableName<table> {
  return table[tableMetadataKey].name as TableName<table>
}

/**
 * Returns a table's schema map.
 * @param table Source table instance.
 * @returns Table schema map.
 */
export function getTableColumns<table extends AnyTable>(table: table): TableColumns<table> {
  return table[tableMetadataKey].columns as TableColumns<table>
}

/**
 * Returns a table's primary key columns.
 * @param table Source table instance.
 * @returns Primary key columns.
 */
export function getTablePrimaryKey<table extends AnyTable>(table: table): TablePrimaryKey<table> {
  return table[tableMetadataKey].primaryKey as TablePrimaryKey<table>
}

/**
 * Returns a table's resolved timestamp configuration.
 * @param table Source table instance.
 * @returns Timestamp configuration or `null`.
 */
export function getTableTimestamps<table extends AnyTable>(table: table): TableTimestamps<table> {
  return table[tableMetadataKey].timestamps as TableTimestamps<table>
}

export type OrderDirection = 'asc' | 'desc'

export type OrderByClause = {
  column: string
  direction: OrderDirection
}

export type RelationCardinality = 'one' | 'many'

export type RelationKind = 'hasMany' | 'hasOne' | 'belongsTo' | 'hasManyThrough'

export type RelationResult<relation extends AnyRelation> =
  relation extends Relation<any, infer target, infer cardinality, infer loaded>
    ? cardinality extends 'many'
      ? Array<TableRowWith<target, loaded>>
      : TableRowWith<target, loaded> | null
    : never

export type RelationMapForTable<table extends AnyTable> = Record<
  string,
  Relation<table, AnyTable, RelationCardinality, any>
>

export type LoadedRelationMap<relations extends RelationMapForTable<any>> = Pretty<{
  [name in keyof relations]: RelationResult<relations[name]>
}>

export type KeySelector<table extends AnyTable> =
  | (keyof TableRow<table> & string)
  | readonly (keyof TableRow<table> & string)[]

export type HasManyOptions<source extends AnyTable, target extends AnyTable> = {
  foreignKey?: KeySelector<target>
  targetKey?: KeySelector<source>
}

export type HasOneOptions<source extends AnyTable, target extends AnyTable> = {
  foreignKey?: KeySelector<target>
  targetKey?: KeySelector<source>
}

export type BelongsToOptions<source extends AnyTable, target extends AnyTable> = {
  foreignKey?: KeySelector<source>
  targetKey?: KeySelector<target>
}

export type HasManyThroughOptions<source extends AnyTable, target extends AnyTable> = {
  through: Relation<source, AnyTable, RelationCardinality, any>
  throughForeignKey?: KeySelector<target>
  throughTargetKey?: string | string[]
}

export type RelationModifiers<target extends AnyTable> = {
  where: Predicate[]
  orderBy: OrderByClause[]
  limit?: number
  offset?: number
  with: RelationMapForTable<target>
}

export type ThroughRelationMetadata = {
  relation: AnyRelation
  throughSourceKey: string[]
  throughTargetKey: string[]
}

export type Relation<
  source extends AnyTable,
  target extends AnyTable,
  cardinality extends RelationCardinality,
  loaded extends Record<string, unknown> = {},
> = {
  kind: 'relation'
  relationKind: RelationKind
  sourceTable: source
  targetTable: target
  cardinality: cardinality
  sourceKey: string[]
  targetKey: string[]
  through?: ThroughRelationMetadata
  modifiers: RelationModifiers<target>
  where(
    input: WhereInput<TableColumnName<target> | QualifiedTableColumnName<target>>,
  ): Relation<source, target, cardinality, loaded>
  orderBy(
    column: TableColumnInput<target>,
    direction?: OrderDirection,
  ): Relation<source, target, cardinality, loaded>
  limit(value: number): Relation<source, target, cardinality, loaded>
  offset(value: number): Relation<source, target, cardinality, loaded>
  with<relations extends RelationMapForTable<target>>(
    relations: relations,
  ): Relation<source, target, cardinality, loaded & LoadedRelationMap<relations>>
}

export type AnyRelation = Relation<AnyTable, AnyTable, RelationCardinality, any>

export type CreateTableOptions<
  name extends string,
  columns extends ColumnSchemas,
  primaryKey extends
    | ColumnNameFromColumns<columns>
    | readonly ColumnNameFromColumns<columns>[]
    | undefined,
> = {
  name: name
  columns: columns
  primaryKey?: primaryKey
  timestamps?: TimestampOptions
}

let defaultTimestampConfig: TimestampConfig = {
  createdAt: 'created_at',
  updatedAt: 'updated_at',
}

/**
 * Creates a table object with symbol-backed metadata and direct column references.
 * @param options Table declaration options.
 * @returns A frozen table object.
 */
export function createTable<
  name extends string,
  columns extends ColumnSchemas,
  primaryKey extends
    | ColumnNameFromColumns<columns>
    | readonly ColumnNameFromColumns<columns>[]
    | undefined = undefined,
>(
  options: CreateTableOptions<name, columns, primaryKey>,
): Table<name, columns, NormalizePrimaryKey<columns, primaryKey>> {
  let resolvedPrimaryKey = normalizePrimaryKey(options.name, options.columns, options.primaryKey)
  let timestampConfig = normalizeTimestampConfig(options.timestamps)
  let table = Object.create(null) as Table<name, columns, NormalizePrimaryKey<columns, primaryKey>>

  Object.defineProperty(table, tableMetadataKey, {
    value: Object.freeze({
      name: options.name,
      columns: options.columns,
      primaryKey: resolvedPrimaryKey,
      timestamps: timestampConfig,
    }),
    enumerable: false,
    writable: false,
    configurable: false,
  })

  for (let columnName in options.columns) {
    if (!Object.prototype.hasOwnProperty.call(options.columns, columnName)) {
      continue
    }

    let schema = options.columns[columnName]
    let column = createColumnReference(options.name, columnName, schema)

    Object.defineProperty(table, columnName, {
      value: column,
      enumerable: true,
      writable: false,
      configurable: false,
    })
  }

  return Object.freeze(table) as Table<name, columns, NormalizePrimaryKey<columns, primaryKey>>
}

function createColumnReference<
  tableName extends string,
  columnName extends string,
  schema extends DataSchema<any, any>,
>(
  tableName: tableName,
  columnName: columnName,
  schema: schema,
): ColumnReference<tableName, columnName, schema> {
  return Object.freeze({
    kind: 'column',
    [columnMetadataKey]: Object.freeze({
      tableName,
      columnName,
      qualifiedName: tableName + '.' + columnName,
      schema,
    }),
  }) as ColumnReference<tableName, columnName, schema>
}

/**
 * Defines a one-to-many relation from `source` to `target`.
 * @param source Source table.
 * @param target Target table.
 * @param relationOptions Relation key configuration.
 * @returns A relation descriptor.
 */
export function hasMany<source extends AnyTable, target extends AnyTable>(
  source: source,
  target: target,
  relationOptions?: HasManyOptions<source, target>,
): Relation<source, target, 'many'> {
  let sourceKey = normalizeKeySelector(
    source,
    relationOptions?.targetKey,
    'targetKey',
    getTablePrimaryKey(source) as string[],
  )
  let targetKey = normalizeKeySelector(target, relationOptions?.foreignKey, 'foreignKey', [
    inferForeignKey(getTableName(source)),
  ])

  assertKeyLengths(getTableName(source), getTableName(target), sourceKey, targetKey)

  return createRelation({
    relationKind: 'hasMany',
    cardinality: 'many',
    sourceTable: source,
    targetTable: target,
    sourceKey,
    targetKey,
  })
}

/**
 * Defines a one-to-one relation from `source` to `target` where the foreign key lives on `target`.
 * @param source Source table.
 * @param target Target table.
 * @param relationOptions Relation key configuration.
 * @returns A relation descriptor.
 */
export function hasOne<source extends AnyTable, target extends AnyTable>(
  source: source,
  target: target,
  relationOptions?: HasOneOptions<source, target>,
): Relation<source, target, 'one'> {
  let sourceKey = normalizeKeySelector(
    source,
    relationOptions?.targetKey,
    'targetKey',
    getTablePrimaryKey(source) as string[],
  )
  let targetKey = normalizeKeySelector(target, relationOptions?.foreignKey, 'foreignKey', [
    inferForeignKey(getTableName(source)),
  ])

  assertKeyLengths(getTableName(source), getTableName(target), sourceKey, targetKey)

  return createRelation({
    relationKind: 'hasOne',
    cardinality: 'one',
    sourceTable: source,
    targetTable: target,
    sourceKey,
    targetKey,
  })
}

/**
 * Defines a one-to-one relation from `source` to `target`.
 * @param source Source table.
 * @param target Target table.
 * @param relationOptions Relation key configuration.
 * @returns A relation descriptor.
 */
export function belongsTo<source extends AnyTable, target extends AnyTable>(
  source: source,
  target: target,
  relationOptions?: BelongsToOptions<source, target>,
): Relation<source, target, 'one'> {
  let sourceKey = normalizeKeySelector(source, relationOptions?.foreignKey, 'foreignKey', [
    inferForeignKey(getTableName(target)),
  ])
  let targetKey = normalizeKeySelector(
    target,
    relationOptions?.targetKey,
    'targetKey',
    getTablePrimaryKey(target) as string[],
  )

  assertKeyLengths(getTableName(source), getTableName(target), sourceKey, targetKey)

  return createRelation({
    relationKind: 'belongsTo',
    cardinality: 'one',
    sourceTable: source,
    targetTable: target,
    sourceKey,
    targetKey,
  })
}

/**
 * Defines a one-to-many relation from `source` to `target` through an intermediate relation.
 * @param source Source table.
 * @param target Target table.
 * @param relationOptions Through relation configuration.
 * @returns A relation descriptor.
 */
export function hasManyThrough<source extends AnyTable, target extends AnyTable>(
  source: source,
  target: target,
  relationOptions: HasManyThroughOptions<source, target>,
): Relation<source, target, 'many'> {
  let throughRelation = relationOptions.through

  if (throughRelation.sourceTable !== source) {
    throw new Error(
      'hasManyThrough expects a through relation whose source table matches ' +
        getTableName(source),
    )
  }

  let throughTargetKey = normalizeKeysForTable(
    throughRelation.targetTable,
    relationOptions.throughTargetKey,
    'throughTargetKey',
    getTablePrimaryKey(throughRelation.targetTable),
  )
  let throughForeignKey = normalizeKeySelector(
    target,
    relationOptions.throughForeignKey,
    'throughForeignKey',
    [inferForeignKey(getTableName(throughRelation.targetTable))],
  )

  assertKeyLengths(
    getTableName(throughRelation.targetTable),
    getTableName(target),
    throughTargetKey,
    throughForeignKey,
  )

  return createRelation({
    relationKind: 'hasManyThrough',
    cardinality: 'many',
    sourceTable: source,
    targetTable: target,
    sourceKey: [...throughRelation.sourceKey],
    targetKey: [...throughRelation.targetKey],
    through: {
      relation: throughRelation as AnyRelation,
      throughSourceKey: throughTargetKey,
      throughTargetKey: throughForeignKey,
    },
  })
}

/**
 * Creates a schema that accepts `Date`, string, and numeric timestamp inputs.
 * @returns Timestamp schema for generated timestamp helpers.
 */
export function timestampSchema(): DataSchema<unknown, Date | string | number> {
  return {
    '~standard': {
      version: 1,
      vendor: 'data-table',
      validate(value: unknown) {
        if (value instanceof Date) {
          return { value }
        }

        if (typeof value === 'string' || typeof value === 'number') {
          return { value }
        }

        return {
          issues: [
            {
              message: 'Expected Date, string, or number',
            },
          ],
        }
      },
    },
  }
}

let defaultTimestampSchema = timestampSchema()

/**
 * Convenience helper for standard snake_case timestamp columns.
 * @param schema Schema used for both timestamp columns.
 * @returns Column schema map for `created_at`/`updated_at`.
 */
export function timestamps(
  schema: DataSchema<any, any> = defaultTimestampSchema,
): Record<'created_at' | 'updated_at', DataSchema<any, any>> {
  return {
    created_at: schema,
    updated_at: schema,
  }
}

export type PrimaryKeyInput<table extends AnyTable> =
  TablePrimaryKey<table> extends readonly [infer column extends string]
    ? TableRow<table>[column]
    : Pretty<{
        [column in TablePrimaryKey<table>[number] & keyof TableRow<table>]: TableRow<table>[column]
      }>

/**
 * Normalizes a primary-key input into an object keyed by primary-key columns.
 * @param table Source table.
 * @param value Primary-key input value.
 * @returns Primary-key object.
 */
export function getPrimaryKeyObject<table extends AnyTable>(
  table: table,
  value: PrimaryKeyInput<table>,
): Partial<TableRow<table>> {
  let keys = getTablePrimaryKey(table)

  if (keys.length === 1 && (typeof value !== 'object' || value === null || Array.isArray(value))) {
    let key = keys[0] as keyof TableRow<table>
    return { [key]: value } as Partial<TableRow<table>>
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Composite primary keys require an object value')
  }

  let objectValue = value as Record<string, unknown>
  let output: Partial<TableRow<table>> = {}

  for (let key of keys) {
    if (!(key in objectValue)) {
      throw new Error(
        'Missing key "' + key + '" for primary key lookup on "' + getTableName(table) + '"',
      )
    }

    ;(output as Record<string, unknown>)[key] = objectValue[key]
  }

  return output
}

/**
 * Builds a stable key for a row tuple.
 * @param row Source row.
 * @param columns Columns included in the tuple.
 * @returns Stable tuple key.
 */
export function getCompositeKey(row: Record<string, unknown>, columns: readonly string[]): string {
  let values = columns.map((column) => stableSerialize(row[column]))

  return values.join('::')
}

/**
 * Serializes values into stable string representations for key generation.
 * @param value Value to serialize.
 * @returns Stable serialized value.
 */
export function stableSerialize(value: unknown): string {
  if (value === null) {
    return 'null'
  }

  if (value === undefined) {
    return 'undefined'
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }

  if (typeof value === 'string') {
    return JSON.stringify(value)
  }

  if (value instanceof Date) {
    return 'date:' + value.toISOString()
  }

  return JSON.stringify(value)
}

function normalizePrimaryKey(
  tableName: string,
  columns: ColumnSchemas,
  primaryKey?: string | readonly string[],
): string[] {
  if (primaryKey === undefined) {
    if (!Object.prototype.hasOwnProperty.call(columns, 'id')) {
      throw new Error(
        'Table "' + tableName + '" must define an "id" column or an explicit primaryKey',
      )
    }

    return ['id']
  }

  let keys = Array.isArray(primaryKey) ? [...primaryKey] : [primaryKey]

  if (keys.length === 0) {
    throw new Error('Table "' + tableName + '" primaryKey must contain at least one column')
  }

  for (let key of keys) {
    if (!Object.prototype.hasOwnProperty.call(columns, key)) {
      throw new Error('Table "' + tableName + '" primaryKey column "' + key + '" does not exist')
    }
  }

  return keys
}

function normalizeKeySelector<table extends AnyTable>(
  table: table,
  selector: KeySelector<table> | undefined,
  optionName: string,
  defaultValue: readonly string[],
): string[] {
  return normalizeKeysForTable(table, selector, optionName, defaultValue)
}

function normalizeKeysForTable(
  table: AnyTable,
  selector: string | readonly string[] | undefined,
  optionName: string,
  defaultValue: readonly string[],
): string[] {
  if (selector === undefined) {
    return [...defaultValue]
  }

  let keys = Array.isArray(selector) ? [...selector] : [selector]

  if (keys.length === 0) {
    throw new Error(
      'Option "' + optionName + '" for table "' + getTableName(table) + '" must not be empty',
    )
  }

  let columns = getTableColumns(table)

  for (let key of keys) {
    if (!Object.prototype.hasOwnProperty.call(columns, key)) {
      throw new Error(
        'Unknown column "' +
          key +
          '" in option "' +
          optionName +
          '" for table "' +
          getTableName(table) +
          '"',
      )
    }
  }

  return keys
}

function normalizeTimestampConfig(options: TimestampOptions | undefined): TimestampConfig | null {
  if (!options) {
    return null
  }

  if (options === true) {
    return { ...defaultTimestampConfig }
  }

  return {
    createdAt: options.createdAt ?? defaultTimestampConfig.createdAt,
    updatedAt: options.updatedAt ?? defaultTimestampConfig.updatedAt,
  }
}

function assertKeyLengths(
  sourceTableName: string,
  targetTableName: string,
  sourceKey: string[],
  targetKey: string[],
): void {
  if (sourceKey.length !== targetKey.length) {
    throw new Error(
      'Relation key mismatch between "' +
        sourceTableName +
        '" (' +
        sourceKey.join(', ') +
        ') and "' +
        targetTableName +
        '" (' +
        targetKey.join(', ') +
        ')',
    )
  }
}

type CreateRelationOptions<
  source extends AnyTable,
  target extends AnyTable,
  cardinality extends RelationCardinality,
> = {
  relationKind: RelationKind
  cardinality: cardinality
  sourceTable: source
  targetTable: target
  sourceKey: string[]
  targetKey: string[]
  through?: ThroughRelationMetadata
  modifiers?: Partial<RelationModifiers<target>>
}

function createRelation<
  source extends AnyTable,
  target extends AnyTable,
  cardinality extends RelationCardinality,
  loaded extends Record<string, unknown> = {},
>(
  options: CreateRelationOptions<source, target, cardinality>,
): Relation<source, target, cardinality, loaded> {
  let baseModifiers: RelationModifiers<target> = {
    where: options.modifiers?.where ? [...options.modifiers.where] : [],
    orderBy: options.modifiers?.orderBy ? [...options.modifiers.orderBy] : [],
    limit: options.modifiers?.limit,
    offset: options.modifiers?.offset,
    with: options.modifiers?.with ? { ...options.modifiers.with } : {},
  }

  let relation: Relation<source, target, cardinality, loaded> = {
    kind: 'relation',
    relationKind: options.relationKind,
    sourceTable: options.sourceTable,
    targetTable: options.targetTable,
    cardinality: options.cardinality,
    sourceKey: [...options.sourceKey],
    targetKey: [...options.targetKey],
    through: options.through,
    modifiers: baseModifiers,

    where(input: WhereInput<TableColumnName<target> | QualifiedTableColumnName<target>>) {
      let predicate = normalizeWhereInput(input)
      return cloneRelation(relation, {
        where: [...relation.modifiers.where, predicate],
      })
    },

    orderBy(column: TableColumnInput<target>, direction: OrderDirection = 'asc') {
      return cloneRelation(relation, {
        orderBy: [
          ...relation.modifiers.orderBy,
          {
            column: normalizeColumnInput(column),
            direction,
          },
        ],
      })
    },

    limit(value: number) {
      return cloneRelation(relation, {
        limit: value,
      })
    },

    offset(value: number) {
      return cloneRelation(relation, {
        offset: value,
      })
    },

    with<relations extends RelationMapForTable<target>>(relations: relations) {
      return cloneRelation(relation, {
        with: {
          ...relation.modifiers.with,
          ...relations,
        },
      }) as Relation<source, target, cardinality, loaded & LoadedRelationMap<relations>>
    },
  }

  return relation
}

function cloneRelation<
  source extends AnyTable,
  target extends AnyTable,
  cardinality extends RelationCardinality,
  loaded extends Record<string, unknown>,
>(
  relation: Relation<source, target, cardinality, loaded>,
  patch: Partial<RelationModifiers<target>>,
): Relation<source, target, cardinality, loaded> {
  return createRelation({
    relationKind: relation.relationKind,
    cardinality: relation.cardinality,
    sourceTable: relation.sourceTable,
    targetTable: relation.targetTable,
    sourceKey: relation.sourceKey,
    targetKey: relation.targetKey,
    through: relation.through,
    modifiers: {
      where: patch.where ?? relation.modifiers.where,
      orderBy: patch.orderBy ?? relation.modifiers.orderBy,
      limit: patch.limit ?? relation.modifiers.limit,
      offset: patch.offset ?? relation.modifiers.offset,
      with: patch.with ?? relation.modifiers.with,
    },
  })
}
