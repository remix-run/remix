import type { Predicate, WhereInput } from './operators.ts'
import { inferForeignKey, singularize } from './inflection.ts'
import { normalizeWhereInput } from './operators.ts'

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

export type ColumnSchemas = Record<string, DataSchema<any, any>>

export type InferSchemaOutput<schema> =
  schema extends DataSchema<any, infer output> ? output : never

export type TableRow<table extends AnyTable> = {
  [column in keyof table['columns']]: InferSchemaOutput<table['columns'][column]>
}

export type OrderDirection = 'asc' | 'desc'

export type OrderByClause = {
  column: string
  direction: OrderDirection
}

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

export type RelationCardinality = 'one' | 'many'

export type RelationKind = 'hasMany' | 'hasOne' | 'belongsTo' | 'hasManyThrough'

export type RelationResult<relation extends AnyRelation> =
  relation extends Relation<any, infer target, infer cardinality, infer loaded>
    ? cardinality extends 'many'
      ? Array<TableRow<target> & loaded>
      : (TableRow<target> & loaded) | null
    : never

export type RelationMapForTable<table extends AnyTable> = Record<
  string,
  Relation<table, AnyTable, RelationCardinality, any>
>

export type LoadedRelationMap<relations extends RelationMapForTable<any>> = {
  [name in keyof relations]: RelationResult<relations[name]>
}

export type KeySelector<table extends AnyTable> =
  | (keyof TableRow<table> & string)
  | readonly (keyof TableRow<table> & string)[]

export type HasManyOptions<source extends AnyTable, target extends AnyTable> = {
  name?: string
  foreignKey?: KeySelector<target>
  targetKey?: KeySelector<source>
}

export type HasOneOptions<source extends AnyTable, target extends AnyTable> = {
  name?: string
  foreignKey?: KeySelector<target>
  targetKey?: KeySelector<source>
}

export type BelongsToOptions<source extends AnyTable, target extends AnyTable> = {
  name?: string
  foreignKey?: KeySelector<source>
  targetKey?: KeySelector<target>
}

export type HasManyThroughOptions<source extends AnyTable, target extends AnyTable> = {
  name?: string
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
  name: string
  sourceTable: source
  targetTable: target
  cardinality: cardinality
  sourceKey: string[]
  targetKey: string[]
  through?: ThroughRelationMetadata
  modifiers: RelationModifiers<target>
  where(
    input: WhereInput<keyof TableRow<target> & string>,
  ): Relation<source, target, cardinality, loaded>
  orderBy(
    column: keyof TableRow<target> & string,
    direction?: OrderDirection,
  ): Relation<source, target, cardinality, loaded>
  limit(value: number): Relation<source, target, cardinality, loaded>
  offset(value: number): Relation<source, target, cardinality, loaded>
  with<relations extends RelationMapForTable<target>>(
    relations: relations,
  ): Relation<source, target, cardinality, loaded & LoadedRelationMap<relations>>
}

export type TimestampOptions = boolean | { createdAt?: string; updatedAt?: string }

export type TimestampConfig = {
  createdAt: string
  updatedAt: string
}

export type Table<
  name extends string,
  columns extends ColumnSchemas,
  primaryKey extends readonly ColumnNameFromColumns<columns>[],
> = {
  kind: 'table'
  name: name
  columns: columns
  primaryKey: primaryKey
  timestamps: TimestampConfig | null
  hasMany<target extends AnyTable>(
    target: target,
    options?: HasManyOptions<Table<name, columns, primaryKey>, target>,
  ): Relation<Table<name, columns, primaryKey>, target, 'many'>
  hasOne<target extends AnyTable>(
    target: target,
    options?: HasOneOptions<Table<name, columns, primaryKey>, target>,
  ): Relation<Table<name, columns, primaryKey>, target, 'one'>
  belongsTo<target extends AnyTable>(
    target: target,
    options?: BelongsToOptions<Table<name, columns, primaryKey>, target>,
  ): Relation<Table<name, columns, primaryKey>, target, 'one'>
  hasManyThrough<target extends AnyTable>(
    target: target,
    options: HasManyThroughOptions<Table<name, columns, primaryKey>, target>,
  ): Relation<Table<name, columns, primaryKey>, target, 'many'>
}

export type AnyTable = Table<string, ColumnSchemas, readonly string[]>

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

let DEFAULT_TIMESTAMP_CONFIG: TimestampConfig = {
  createdAt: 'created_at',
  updatedAt: 'updated_at',
}

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

  let table: Table<name, columns, NormalizePrimaryKey<columns, primaryKey>> = {
    kind: 'table',
    name: options.name,
    columns: options.columns,
    primaryKey: resolvedPrimaryKey as unknown as NormalizePrimaryKey<columns, primaryKey>,
    timestamps: timestampConfig,

    hasMany<target extends AnyTable>(
      target: target,
      relationOptions?: HasManyOptions<
        Table<name, columns, NormalizePrimaryKey<columns, primaryKey>>,
        target
      >,
    ): Relation<Table<name, columns, NormalizePrimaryKey<columns, primaryKey>>, target, 'many'> {
      let sourceKey = normalizeKeySelector(
        table,
        relationOptions?.targetKey,
        'targetKey',
        table.primaryKey as string[],
      )
      let targetKey = normalizeKeySelector(target, relationOptions?.foreignKey, 'foreignKey', [
        inferForeignKey(table.name),
      ])

      assertKeyLengths(table.name, target.name, sourceKey, targetKey)

      return createRelation({
        relationKind: 'hasMany',
        cardinality: 'many',
        name: relationOptions?.name ?? target.name,
        sourceTable: table,
        targetTable: target,
        sourceKey,
        targetKey,
      })
    },

    hasOne<target extends AnyTable>(
      target: target,
      relationOptions?: HasOneOptions<
        Table<name, columns, NormalizePrimaryKey<columns, primaryKey>>,
        target
      >,
    ): Relation<Table<name, columns, NormalizePrimaryKey<columns, primaryKey>>, target, 'one'> {
      let sourceKey = normalizeKeySelector(
        table,
        relationOptions?.targetKey,
        'targetKey',
        table.primaryKey as string[],
      )
      let targetKey = normalizeKeySelector(target, relationOptions?.foreignKey, 'foreignKey', [
        inferForeignKey(table.name),
      ])

      assertKeyLengths(table.name, target.name, sourceKey, targetKey)

      return createRelation({
        relationKind: 'hasOne',
        cardinality: 'one',
        name: relationOptions?.name ?? singularize(target.name),
        sourceTable: table,
        targetTable: target,
        sourceKey,
        targetKey,
      })
    },

    belongsTo<target extends AnyTable>(
      target: target,
      relationOptions?: BelongsToOptions<
        Table<name, columns, NormalizePrimaryKey<columns, primaryKey>>,
        target
      >,
    ): Relation<Table<name, columns, NormalizePrimaryKey<columns, primaryKey>>, target, 'one'> {
      let sourceKey = normalizeKeySelector(table, relationOptions?.foreignKey, 'foreignKey', [
        inferForeignKey(target.name),
      ])
      let targetKey = normalizeKeySelector(
        target,
        relationOptions?.targetKey,
        'targetKey',
        target.primaryKey as string[],
      )

      assertKeyLengths(table.name, target.name, sourceKey, targetKey)

      return createRelation({
        relationKind: 'belongsTo',
        cardinality: 'one',
        name: relationOptions?.name ?? singularize(target.name),
        sourceTable: table,
        targetTable: target,
        sourceKey,
        targetKey,
      })
    },

    hasManyThrough<target extends AnyTable>(
      target: target,
      relationOptions: HasManyThroughOptions<
        Table<name, columns, NormalizePrimaryKey<columns, primaryKey>>,
        target
      >,
    ): Relation<Table<name, columns, NormalizePrimaryKey<columns, primaryKey>>, target, 'many'> {
      let throughRelation = relationOptions.through

      if (throughRelation.sourceTable !== table) {
        throw new Error(
          'hasManyThrough expects a through relation whose source table matches ' + table.name,
        )
      }

      let throughTargetKey = normalizeStringKeysForTable(
        throughRelation.targetTable,
        relationOptions.throughTargetKey,
        'throughTargetKey',
        throughRelation.targetTable.primaryKey,
      )
      let throughForeignKey = normalizeKeySelector(
        target,
        relationOptions.throughForeignKey,
        'throughForeignKey',
        [inferForeignKey(throughRelation.targetTable.name)],
      )

      assertKeyLengths(
        throughRelation.targetTable.name,
        target.name,
        throughTargetKey,
        throughForeignKey,
      )

      return createRelation({
        relationKind: 'hasManyThrough',
        cardinality: 'many',
        name: relationOptions.name ?? target.name,
        sourceTable: table,
        targetTable: target,
        sourceKey: [...throughRelation.sourceKey],
        targetKey: [...throughRelation.targetKey],
        through: {
          relation: throughRelation as AnyRelation,
          throughSourceKey: throughTargetKey,
          throughTargetKey: throughForeignKey,
        },
      })
    },
  }

  return table
}

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

let DEFAULT_TIMESTAMP_SCHEMA = timestampSchema()

export function timestamps(
  schema: DataSchema<any, any> = DEFAULT_TIMESTAMP_SCHEMA,
): Record<'created_at' | 'updated_at', DataSchema<any, any>> {
  return {
    created_at: schema,
    updated_at: schema,
  }
}

export type PrimaryKeyInput<table extends AnyTable> = table['primaryKey'] extends readonly [
  infer column extends string,
]
  ? TableRow<table>[column]
  : {
      [column in table['primaryKey'][number] & keyof TableRow<table>]: TableRow<table>[column]
    }

export function getPrimaryKeyObject<table extends AnyTable>(
  table: table,
  value: PrimaryKeyInput<table>,
): Partial<TableRow<table>> {
  let keys = table.primaryKey

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
      throw new Error('Missing key "' + key + '" for primary key lookup on "' + table.name + '"')
    }

    ;(output as Record<string, unknown>)[key] = objectValue[key]
  }

  return output
}

export function getCompositeKey(row: Record<string, unknown>, columns: readonly string[]): string {
  let values = columns.map((column) => stableSerialize(row[column]))

  return values.join('::')
}

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
  if (selector === undefined) {
    return [...defaultValue]
  }

  let keys = Array.isArray(selector) ? [...selector] : [selector]

  if (keys.length === 0) {
    throw new Error('Option "' + optionName + '" for table "' + table.name + '" must not be empty')
  }

  for (let key of keys) {
    if (!Object.prototype.hasOwnProperty.call(table.columns, key)) {
      throw new Error(
        'Unknown column "' +
          key +
          '" in option "' +
          optionName +
          '" for table "' +
          table.name +
          '"',
      )
    }
  }

  return keys
}

function normalizeStringKeysForTable(
  table: AnyTable,
  selector: string | string[] | undefined,
  optionName: string,
  defaultValue: readonly string[],
): string[] {
  if (selector === undefined) {
    return [...defaultValue]
  }

  let keys = Array.isArray(selector) ? [...selector] : [selector]

  if (keys.length === 0) {
    throw new Error('Option "' + optionName + '" for table "' + table.name + '" must not be empty')
  }

  for (let key of keys) {
    if (!Object.prototype.hasOwnProperty.call(table.columns, key)) {
      throw new Error(
        'Unknown column "' +
          key +
          '" in option "' +
          optionName +
          '" for table "' +
          table.name +
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
    return { ...DEFAULT_TIMESTAMP_CONFIG }
  }

  return {
    createdAt: options.createdAt ?? DEFAULT_TIMESTAMP_CONFIG.createdAt,
    updatedAt: options.updatedAt ?? DEFAULT_TIMESTAMP_CONFIG.updatedAt,
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
  name: string
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
    name: options.name,
    sourceTable: options.sourceTable,
    targetTable: options.targetTable,
    cardinality: options.cardinality,
    sourceKey: [...options.sourceKey],
    targetKey: [...options.targetKey],
    through: options.through,
    modifiers: baseModifiers,

    where(input: WhereInput<keyof TableRow<target> & string>) {
      let predicate = normalizeWhereInput(input)
      return cloneRelation(relation, {
        where: [...relation.modifiers.where, predicate],
      })
    },

    orderBy(column: keyof TableRow<target> & string, direction: OrderDirection = 'asc') {
      return cloneRelation(relation, {
        orderBy: [...relation.modifiers.orderBy, { column, direction }],
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
    name: relation.name,
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
