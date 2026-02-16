import { createSchema, parseSafe } from '@remix-run/data-schema';
import { inferForeignKey } from "./inflection.js";
import { normalizeWhereInput } from "./operators.js";
import { columnMetadataKey, normalizeColumnInput, tableMetadataKey } from "./references.js";
/**
 * Symbol key used to store non-enumerable table metadata.
 */
export { columnMetadataKey, tableMetadataKey } from "./references.js";
/**
 * Creates a plain table reference snapshot from a table instance.
 * @param table Source table instance.
 * @returns Table metadata snapshot.
 */
export function getTableReference(table) {
    let metadata = table[tableMetadataKey];
    return {
        kind: 'table',
        name: metadata.name,
        columns: metadata.columns,
        primaryKey: metadata.primaryKey,
        timestamps: metadata.timestamps,
    };
}
/**
 * Returns a table's SQL name.
 * @param table Source table instance.
 * @returns Table SQL name.
 */
export function getTableName(table) {
    return table[tableMetadataKey].name;
}
/**
 * Returns a table's schema map.
 * @param table Source table instance.
 * @returns Table schema map.
 */
export function getTableColumns(table) {
    return table[tableMetadataKey].columns;
}
/**
 * Returns a table's primary key columns.
 * @param table Source table instance.
 * @returns Primary key columns.
 */
export function getTablePrimaryKey(table) {
    return table[tableMetadataKey].primaryKey;
}
/**
 * Returns a table's resolved timestamp configuration.
 * @param table Source table instance.
 * @returns Timestamp configuration or `null`.
 */
export function getTableTimestamps(table) {
    return table[tableMetadataKey].timestamps;
}
let defaultTimestampConfig = {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
};
function prefixIssuePath(issue, key) {
    let issuePath = issue.path ?? [];
    return {
        ...issue,
        path: [key, ...issuePath],
    };
}
function validatePartialRowInput(tableName, columns, value, options) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return {
            issues: [{ message: 'Expected object' }],
        };
    }
    let input = value;
    let output = {};
    let issues = [];
    for (let key in input) {
        if (!Object.prototype.hasOwnProperty.call(input, key)) {
            continue;
        }
        if (!Object.prototype.hasOwnProperty.call(columns, key)) {
            issues.push({
                message: 'Unknown column "' + key + '" for table "' + tableName + '"',
                path: [key],
            });
            continue;
        }
        let result = parseSafe(columns[key], input[key], options);
        if (!result.success) {
            issues.push(...result.issues.map((issue) => prefixIssuePath(issue, key)));
            continue;
        }
        output[key] = result.value;
    }
    if (issues.length > 0) {
        return { issues };
    }
    return { value: output };
}
export function validatePartialRow(table, value, options) {
    let result = validatePartialRowInput(getTableName(table), getTableColumns(table), value, options);
    if ('issues' in result) {
        return result;
    }
    return {
        value: result.value,
    };
}
/**
 * Creates a table object with symbol-backed metadata and direct column references.
 * @param options Table declaration options.
 * @returns A frozen table object.
 */
export function createTable(options) {
    let tableName = options.name;
    let columns = options.columns;
    if (Object.prototype.hasOwnProperty.call(columns, '~standard')) {
        throw new Error('Column name "~standard" is reserved for table validation on "' + tableName + '"');
    }
    let resolvedPrimaryKey = normalizePrimaryKey(tableName, columns, options.primaryKey);
    let timestampConfig = normalizeTimestampConfig(options.timestamps);
    let table = Object.create(null);
    Object.defineProperty(table, tableMetadataKey, {
        value: Object.freeze({
            name: tableName,
            columns,
            primaryKey: resolvedPrimaryKey,
            timestamps: timestampConfig,
        }),
        enumerable: false,
        writable: false,
        configurable: false,
    });
    Object.defineProperty(table, '~standard', {
        value: Object.freeze({
            version: 1,
            vendor: 'data-table',
            validate(value, parseOptions) {
                return validatePartialRowInput(tableName, columns, value, parseOptions);
            },
        }),
        enumerable: false,
        writable: false,
        configurable: false,
    });
    for (let columnName in columns) {
        if (!Object.prototype.hasOwnProperty.call(columns, columnName)) {
            continue;
        }
        let schema = columns[columnName];
        let column = createColumnReference(tableName, columnName, schema);
        Object.defineProperty(table, columnName, {
            value: column,
            enumerable: true,
            writable: false,
            configurable: false,
        });
    }
    return Object.freeze(table);
}
function createColumnReference(tableName, columnName, schema) {
    return Object.freeze({
        kind: 'column',
        [columnMetadataKey]: Object.freeze({
            tableName,
            columnName,
            qualifiedName: tableName + '.' + columnName,
            schema,
        }),
    });
}
/**
 * Defines a one-to-many relation from `source` to `target`.
 * @param source Source table.
 * @param target Target table.
 * @param relationOptions Relation key configuration.
 * @returns A relation descriptor.
 */
export function hasMany(source, target, relationOptions) {
    let sourceKey = normalizeKeySelector(source, relationOptions?.targetKey, 'targetKey', getTablePrimaryKey(source));
    let targetKey = normalizeKeySelector(target, relationOptions?.foreignKey, 'foreignKey', [
        inferForeignKey(getTableName(source)),
    ]);
    assertKeyLengths(getTableName(source), getTableName(target), sourceKey, targetKey);
    return createRelation({
        relationKind: 'hasMany',
        cardinality: 'many',
        sourceTable: source,
        targetTable: target,
        sourceKey,
        targetKey,
    });
}
/**
 * Defines a one-to-one relation from `source` to `target` where the foreign key lives on `target`.
 * @param source Source table.
 * @param target Target table.
 * @param relationOptions Relation key configuration.
 * @returns A relation descriptor.
 */
export function hasOne(source, target, relationOptions) {
    let sourceKey = normalizeKeySelector(source, relationOptions?.targetKey, 'targetKey', getTablePrimaryKey(source));
    let targetKey = normalizeKeySelector(target, relationOptions?.foreignKey, 'foreignKey', [
        inferForeignKey(getTableName(source)),
    ]);
    assertKeyLengths(getTableName(source), getTableName(target), sourceKey, targetKey);
    return createRelation({
        relationKind: 'hasOne',
        cardinality: 'one',
        sourceTable: source,
        targetTable: target,
        sourceKey,
        targetKey,
    });
}
/**
 * Defines a one-to-one relation from `source` to `target`.
 * @param source Source table.
 * @param target Target table.
 * @param relationOptions Relation key configuration.
 * @returns A relation descriptor.
 */
export function belongsTo(source, target, relationOptions) {
    let sourceKey = normalizeKeySelector(source, relationOptions?.foreignKey, 'foreignKey', [
        inferForeignKey(getTableName(target)),
    ]);
    let targetKey = normalizeKeySelector(target, relationOptions?.targetKey, 'targetKey', getTablePrimaryKey(target));
    assertKeyLengths(getTableName(source), getTableName(target), sourceKey, targetKey);
    return createRelation({
        relationKind: 'belongsTo',
        cardinality: 'one',
        sourceTable: source,
        targetTable: target,
        sourceKey,
        targetKey,
    });
}
/**
 * Defines a one-to-many relation from `source` to `target` through an intermediate relation.
 * @param source Source table.
 * @param target Target table.
 * @param relationOptions Through relation configuration.
 * @returns A relation descriptor.
 */
export function hasManyThrough(source, target, relationOptions) {
    let throughRelation = relationOptions.through;
    if (throughRelation.sourceTable !== source) {
        throw new Error('hasManyThrough expects a through relation whose source table matches ' +
            getTableName(source));
    }
    let throughTargetKey = normalizeKeysForTable(throughRelation.targetTable, relationOptions.throughTargetKey, 'throughTargetKey', getTablePrimaryKey(throughRelation.targetTable));
    let throughForeignKey = normalizeKeySelector(target, relationOptions.throughForeignKey, 'throughForeignKey', [inferForeignKey(getTableName(throughRelation.targetTable))]);
    assertKeyLengths(getTableName(throughRelation.targetTable), getTableName(target), throughTargetKey, throughForeignKey);
    return createRelation({
        relationKind: 'hasManyThrough',
        cardinality: 'many',
        sourceTable: source,
        targetTable: target,
        sourceKey: [...throughRelation.sourceKey],
        targetKey: [...throughRelation.targetKey],
        through: {
            relation: throughRelation,
            throughSourceKey: throughTargetKey,
            throughTargetKey: throughForeignKey,
        },
    });
}
/**
 * Creates a schema that accepts `Date`, string, and numeric timestamp inputs.
 * @returns Timestamp schema for generated timestamp helpers.
 */
export function timestampSchema() {
    return createSchema((value) => {
        if (value instanceof Date) {
            return { value };
        }
        if (typeof value === 'string' || typeof value === 'number') {
            return { value };
        }
        return {
            issues: [{ message: 'Expected Date, string, or number' }],
        };
    });
}
let defaultTimestampSchema = timestampSchema();
/**
 * Convenience helper for standard snake_case timestamp columns.
 * @param schema Schema used for both timestamp columns.
 * @returns Column schema map for `created_at`/`updated_at`.
 */
export function timestamps(schema = defaultTimestampSchema) {
    return {
        created_at: schema,
        updated_at: schema,
    };
}
/**
 * Normalizes a primary-key input into an object keyed by primary-key columns.
 * @param table Source table.
 * @param value Primary-key input value.
 * @returns Primary-key object.
 */
export function getPrimaryKeyObject(table, value) {
    let keys = getTablePrimaryKey(table);
    if (keys.length === 1 && (typeof value !== 'object' || value === null || Array.isArray(value))) {
        let key = keys[0];
        return { [key]: value };
    }
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new Error('Composite primary keys require an object value');
    }
    let objectValue = value;
    let output = {};
    for (let key of keys) {
        if (!(key in objectValue)) {
            throw new Error('Missing key "' + key + '" for primary key lookup on "' + getTableName(table) + '"');
        }
        ;
        output[key] = objectValue[key];
    }
    return output;
}
/**
 * Builds a stable key for a row tuple.
 * @param row Source row.
 * @param columns Columns included in the tuple.
 * @returns Stable tuple key.
 */
export function getCompositeKey(row, columns) {
    let values = columns.map((column) => stableSerialize(row[column]));
    return values.join('::');
}
/**
 * Serializes values into stable string representations for key generation.
 * @param value Value to serialize.
 * @returns Stable serialized value.
 */
export function stableSerialize(value) {
    if (value === null) {
        return 'null';
    }
    if (value === undefined) {
        return 'undefined';
    }
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
        return String(value);
    }
    if (typeof value === 'string') {
        return JSON.stringify(value);
    }
    if (value instanceof Date) {
        return 'date:' + value.toISOString();
    }
    return JSON.stringify(value);
}
function normalizePrimaryKey(tableName, columns, primaryKey) {
    if (primaryKey === undefined) {
        if (!Object.prototype.hasOwnProperty.call(columns, 'id')) {
            throw new Error('Table "' + tableName + '" must define an "id" column or an explicit primaryKey');
        }
        return ['id'];
    }
    let keys = Array.isArray(primaryKey) ? [...primaryKey] : [primaryKey];
    if (keys.length === 0) {
        throw new Error('Table "' + tableName + '" primaryKey must contain at least one column');
    }
    for (let key of keys) {
        if (!Object.prototype.hasOwnProperty.call(columns, key)) {
            throw new Error('Table "' + tableName + '" primaryKey column "' + key + '" does not exist');
        }
    }
    return keys;
}
function normalizeKeySelector(table, selector, optionName, defaultValue) {
    return normalizeKeysForTable(table, selector, optionName, defaultValue);
}
function normalizeKeysForTable(table, selector, optionName, defaultValue) {
    if (selector === undefined) {
        return [...defaultValue];
    }
    let keys = Array.isArray(selector) ? [...selector] : [selector];
    if (keys.length === 0) {
        throw new Error('Option "' + optionName + '" for table "' + getTableName(table) + '" must not be empty');
    }
    let columns = getTableColumns(table);
    for (let key of keys) {
        if (!Object.prototype.hasOwnProperty.call(columns, key)) {
            throw new Error('Unknown column "' +
                key +
                '" in option "' +
                optionName +
                '" for table "' +
                getTableName(table) +
                '"');
        }
    }
    return keys;
}
function normalizeTimestampConfig(options) {
    if (!options) {
        return null;
    }
    if (options === true) {
        return { ...defaultTimestampConfig };
    }
    return {
        createdAt: options.createdAt ?? defaultTimestampConfig.createdAt,
        updatedAt: options.updatedAt ?? defaultTimestampConfig.updatedAt,
    };
}
function assertKeyLengths(sourceTableName, targetTableName, sourceKey, targetKey) {
    if (sourceKey.length !== targetKey.length) {
        throw new Error('Relation key mismatch between "' +
            sourceTableName +
            '" (' +
            sourceKey.join(', ') +
            ') and "' +
            targetTableName +
            '" (' +
            targetKey.join(', ') +
            ')');
    }
}
function createRelation(options) {
    let baseModifiers = {
        where: options.modifiers?.where ? [...options.modifiers.where] : [],
        orderBy: options.modifiers?.orderBy ? [...options.modifiers.orderBy] : [],
        limit: options.modifiers?.limit,
        offset: options.modifiers?.offset,
        with: options.modifiers?.with ? { ...options.modifiers.with } : {},
    };
    let relation = {
        kind: 'relation',
        relationKind: options.relationKind,
        sourceTable: options.sourceTable,
        targetTable: options.targetTable,
        cardinality: options.cardinality,
        sourceKey: [...options.sourceKey],
        targetKey: [...options.targetKey],
        through: options.through,
        modifiers: baseModifiers,
        where(input) {
            let predicate = normalizeWhereInput(input);
            return cloneRelation(relation, {
                where: [...relation.modifiers.where, predicate],
            });
        },
        orderBy(column, direction = 'asc') {
            return cloneRelation(relation, {
                orderBy: [
                    ...relation.modifiers.orderBy,
                    {
                        column: normalizeColumnInput(column),
                        direction,
                    },
                ],
            });
        },
        limit(value) {
            return cloneRelation(relation, {
                limit: value,
            });
        },
        offset(value) {
            return cloneRelation(relation, {
                offset: value,
            });
        },
        with(relations) {
            return cloneRelation(relation, {
                with: {
                    ...relation.modifiers.with,
                    ...relations,
                },
            });
        },
    };
    return relation;
}
function cloneRelation(relation, patch) {
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
    });
}
