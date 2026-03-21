import type { Predicate, WhereInput } from './operators.ts'
import { inferForeignKey } from './inflection.ts'
import { normalizeWhereInput } from './operators.ts'
import { normalizeColumnInput } from './references.ts'
import type {
  AnyTable,
  OrderByClause,
  OrderDirection,
  QualifiedTableColumnName,
  TableColumnInput,
  TableColumnName,
  TableRow,
  TableRowWith,
} from './table.ts'
import { getTableColumns, getTableName, getTablePrimaryKey } from './table.ts'
import type { Pretty } from './types.ts'

/**
 * Cardinality of a relation.
 */
export type RelationCardinality = 'one' | 'many'

/**
 * Supported relation kinds.
 */
export type RelationKind = 'hasMany' | 'hasOne' | 'belongsTo' | 'hasManyThrough'

export type RelationResult<relation extends AnyRelation> =
  relation extends Relation<any, infer target, infer cardinality, infer loaded>
    ? cardinality extends 'many'
      ? Array<TableRowWith<target, loaded>>
      : TableRowWith<target, loaded> | null
    : never

/**
 * Named relation map for a source table.
 */
export type RelationMapForTable<table extends AnyTable> = Record<
  string,
  Relation<table, AnyTable, RelationCardinality, any>
>

export type LoadedRelationMap<relations extends RelationMapForTable<any>> = Pretty<{
  [name in keyof relations]: RelationResult<relations[name]>
}>

/**
 * Column or column list used to join relations.
 */
export type KeySelector<table extends AnyTable> =
  | (keyof TableRow<table> & string)
  | readonly (keyof TableRow<table> & string)[]

/**
 * Options for defining a {@link hasMany} relation.
 */
export type HasManyOptions<source extends AnyTable, target extends AnyTable> = {
  foreignKey?: KeySelector<target>
  targetKey?: KeySelector<source>
}

/**
 * Options for defining a {@link hasOne} relation.
 */
export type HasOneOptions<source extends AnyTable, target extends AnyTable> = {
  foreignKey?: KeySelector<target>
  targetKey?: KeySelector<source>
}

/**
 * Options for defining a {@link belongsTo} relation.
 */
export type BelongsToOptions<source extends AnyTable, target extends AnyTable> = {
  foreignKey?: KeySelector<source>
  targetKey?: KeySelector<target>
}

/**
 * Options for defining a {@link hasManyThrough} relation.
 */
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

/**
 * Relation descriptor used by query loading.
 */
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

/**
 * Relation descriptor with erased table types.
 */
export type AnyRelation = Relation<AnyTable, AnyTable, RelationCardinality, any>

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
  let sourceKey = normalizeKeysForTable(
    source,
    relationOptions?.targetKey,
    'targetKey',
    getTablePrimaryKey(source) as string[],
  )
  let targetKey = normalizeKeysForTable(target, relationOptions?.foreignKey, 'foreignKey', [
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
  let sourceKey = normalizeKeysForTable(
    source,
    relationOptions?.targetKey,
    'targetKey',
    getTablePrimaryKey(source) as string[],
  )
  let targetKey = normalizeKeysForTable(target, relationOptions?.foreignKey, 'foreignKey', [
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
  let sourceKey = normalizeKeysForTable(source, relationOptions?.foreignKey, 'foreignKey', [
    inferForeignKey(getTableName(target)),
  ])
  let targetKey = normalizeKeysForTable(
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
  let throughForeignKey = normalizeKeysForTable(
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
