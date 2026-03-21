import type { Predicate, WhereInput } from './operators.ts'
import { inferForeignKey } from './inflection.ts'
import { normalizeWhereInput } from './operators.ts'
import { normalizeColumnInput } from './references.ts'
import type {
  AnyTable,
  QualifiedTableColumnName,
  TableColumnInput,
  TableColumnName,
  TableRow,
  TableRowWith,
} from './table/metadata.ts'
import type { OrderByClause, OrderDirection } from './table/ordering.ts'
import { getTableColumns, getTableName, getTablePrimaryKey } from './table/metadata.ts'
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
  return createDirectRelation({
    relationKind: 'hasMany',
    cardinality: 'many',
    sourceTable: source,
    targetTable: target,
    sourceSelector: relationOptions?.targetKey,
    sourceOptionName: 'targetKey',
    sourceDefault: getTablePrimaryKeyNames(source),
    targetSelector: relationOptions?.foreignKey,
    targetOptionName: 'foreignKey',
    targetDefault: [inferForeignKey(getTableName(source))],
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
  return createDirectRelation({
    relationKind: 'hasOne',
    cardinality: 'one',
    sourceTable: source,
    targetTable: target,
    sourceSelector: relationOptions?.targetKey,
    sourceOptionName: 'targetKey',
    sourceDefault: getTablePrimaryKeyNames(source),
    targetSelector: relationOptions?.foreignKey,
    targetOptionName: 'foreignKey',
    targetDefault: [inferForeignKey(getTableName(source))],
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
  return createDirectRelation({
    relationKind: 'belongsTo',
    cardinality: 'one',
    sourceTable: source,
    targetTable: target,
    sourceSelector: relationOptions?.foreignKey,
    sourceOptionName: 'foreignKey',
    sourceDefault: [inferForeignKey(getTableName(target))],
    targetSelector: relationOptions?.targetKey,
    targetOptionName: 'targetKey',
    targetDefault: getTablePrimaryKeyNames(target),
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
  let throughRelation: AnyRelation = relationOptions.through

  if (throughRelation.sourceTable !== source) {
    throw new Error(
      'hasManyThrough expects a through relation whose source table matches ' +
        getTableName(source),
    )
  }

  let { sourceKey: throughTargetKey, targetKey: throughForeignKey } = resolveRelationKeys(
    throughRelation.targetTable,
    target,
    {
      sourceSelector: relationOptions.throughTargetKey,
      sourceOptionName: 'throughTargetKey',
      sourceDefault: getTablePrimaryKeyNames(throughRelation.targetTable),
      targetSelector: relationOptions.throughForeignKey,
      targetOptionName: 'throughForeignKey',
      targetDefault: [inferForeignKey(getTableName(throughRelation.targetTable))],
    },
  )

  return createRelation({
    relationKind: 'hasManyThrough',
    cardinality: 'many',
    sourceTable: source,
    targetTable: target,
    sourceKey: throughRelation.sourceKey,
    targetKey: throughRelation.targetKey,
    through: {
      relation: throughRelation,
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

function resolveRelationKeys(
  sourceTable: AnyTable,
  targetTable: AnyTable,
  options: {
    sourceSelector: string | readonly string[] | undefined
    sourceOptionName: string
    sourceDefault: readonly string[]
    targetSelector: string | readonly string[] | undefined
    targetOptionName: string
    targetDefault: readonly string[]
  },
): {
  sourceKey: string[]
  targetKey: string[]
} {
  let sourceKey = normalizeKeysForTable(
    sourceTable,
    options.sourceSelector,
    options.sourceOptionName,
    options.sourceDefault,
  )
  let targetKey = normalizeKeysForTable(
    targetTable,
    options.targetSelector,
    options.targetOptionName,
    options.targetDefault,
  )

  assertKeyLengths(getTableName(sourceTable), getTableName(targetTable), sourceKey, targetKey)

  return { sourceKey, targetKey }
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
  let relation: Relation<source, target, cardinality, loaded> = {
    kind: 'relation',
    relationKind: options.relationKind,
    sourceTable: options.sourceTable,
    targetTable: options.targetTable,
    cardinality: options.cardinality,
    sourceKey: [...options.sourceKey],
    targetKey: [...options.targetKey],
    through: options.through,
    modifiers: createRelationModifiers(options.modifiers),

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
    modifiers: mergeRelationModifiers(relation, patch),
  })
}

function getTablePrimaryKeyNames(table: AnyTable): string[] {
  return getTablePrimaryKey(table).map((key) => key)
}

type RelationKeyOptions<
  source extends AnyTable,
  target extends AnyTable,
  cardinality extends RelationCardinality,
> = {
  relationKind: RelationKind
  cardinality: cardinality
  sourceTable: source
  targetTable: target
  sourceSelector: string | readonly string[] | undefined
  sourceOptionName: string
  sourceDefault: readonly string[]
  targetSelector: string | readonly string[] | undefined
  targetOptionName: string
  targetDefault: readonly string[]
}

function createDirectRelation<
  source extends AnyTable,
  target extends AnyTable,
  cardinality extends RelationCardinality,
>(
  options: RelationKeyOptions<source, target, cardinality>,
): Relation<source, target, cardinality> {
  let { sourceKey, targetKey } = resolveRelationKeys(options.sourceTable, options.targetTable, {
    sourceSelector: options.sourceSelector,
    sourceOptionName: options.sourceOptionName,
    sourceDefault: options.sourceDefault,
    targetSelector: options.targetSelector,
    targetOptionName: options.targetOptionName,
    targetDefault: options.targetDefault,
  })

  return createRelation({
    relationKind: options.relationKind,
    cardinality: options.cardinality,
    sourceTable: options.sourceTable,
    targetTable: options.targetTable,
    sourceKey,
    targetKey,
  })
}

function createRelationModifiers<target extends AnyTable>(
  modifiers?: Partial<RelationModifiers<target>>,
): RelationModifiers<target> {
  return {
    where: modifiers?.where ? [...modifiers.where] : [],
    orderBy: modifiers?.orderBy ? [...modifiers.orderBy] : [],
    limit: modifiers?.limit,
    offset: modifiers?.offset,
    with: modifiers?.with ? { ...modifiers.with } : {},
  }
}

function mergeRelationModifiers<
  source extends AnyTable,
  target extends AnyTable,
  cardinality extends RelationCardinality,
  loaded extends Record<string, unknown>,
>(
  relation: Relation<source, target, cardinality, loaded>,
  patch: Partial<RelationModifiers<target>>,
): RelationModifiers<target> {
  return createRelationModifiers({
    where: patch.where ?? relation.modifiers.where,
    orderBy: patch.orderBy ?? relation.modifiers.orderBy,
    limit: patch.limit ?? relation.modifiers.limit,
    offset: patch.offset ?? relation.modifiers.offset,
    with: patch.with ?? relation.modifiers.with,
  })
}
