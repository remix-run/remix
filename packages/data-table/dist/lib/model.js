import { inferForeignKey, singularize } from "./inflection.js";
import { normalizeWhereInput } from "./operators.js";
let DEFAULT_TIMESTAMP_CONFIG = {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
};
export function createTable(options) {
    let resolvedPrimaryKey = normalizePrimaryKey(options.name, options.columns, options.primaryKey);
    let timestampConfig = normalizeTimestampConfig(options.timestamps);
    let table = {
        kind: 'table',
        name: options.name,
        columns: options.columns,
        primaryKey: resolvedPrimaryKey,
        timestamps: timestampConfig,
        hasMany(target, relationOptions) {
            let sourceKey = normalizeKeySelector(table, relationOptions?.targetKey, 'targetKey', table.primaryKey);
            let targetKey = normalizeKeySelector(target, relationOptions?.foreignKey, 'foreignKey', [
                inferForeignKey(table.name),
            ]);
            assertKeyLengths(table.name, target.name, sourceKey, targetKey);
            return createRelation({
                relationKind: 'hasMany',
                cardinality: 'many',
                name: relationOptions?.name ?? target.name,
                sourceTable: table,
                targetTable: target,
                sourceKey,
                targetKey,
            });
        },
        hasOne(target, relationOptions) {
            let sourceKey = normalizeKeySelector(table, relationOptions?.targetKey, 'targetKey', table.primaryKey);
            let targetKey = normalizeKeySelector(target, relationOptions?.foreignKey, 'foreignKey', [
                inferForeignKey(table.name),
            ]);
            assertKeyLengths(table.name, target.name, sourceKey, targetKey);
            return createRelation({
                relationKind: 'hasOne',
                cardinality: 'one',
                name: relationOptions?.name ?? singularize(target.name),
                sourceTable: table,
                targetTable: target,
                sourceKey,
                targetKey,
            });
        },
        belongsTo(target, relationOptions) {
            let sourceKey = normalizeKeySelector(table, relationOptions?.foreignKey, 'foreignKey', [
                inferForeignKey(target.name),
            ]);
            let targetKey = normalizeKeySelector(target, relationOptions?.targetKey, 'targetKey', target.primaryKey);
            assertKeyLengths(table.name, target.name, sourceKey, targetKey);
            return createRelation({
                relationKind: 'belongsTo',
                cardinality: 'one',
                name: relationOptions?.name ?? singularize(target.name),
                sourceTable: table,
                targetTable: target,
                sourceKey,
                targetKey,
            });
        },
        hasManyThrough(target, relationOptions) {
            let throughRelation = relationOptions.through;
            if (throughRelation.sourceTable !== table) {
                throw new Error('hasManyThrough expects a through relation whose source table matches ' + table.name);
            }
            let throughTargetKey = normalizeStringKeysForTable(throughRelation.targetTable, relationOptions.throughTargetKey, 'throughTargetKey', throughRelation.targetTable.primaryKey);
            let throughForeignKey = normalizeKeySelector(target, relationOptions.throughForeignKey, 'throughForeignKey', [inferForeignKey(throughRelation.targetTable.name)]);
            assertKeyLengths(throughRelation.targetTable.name, target.name, throughTargetKey, throughForeignKey);
            return createRelation({
                relationKind: 'hasManyThrough',
                cardinality: 'many',
                name: relationOptions.name ?? target.name,
                sourceTable: table,
                targetTable: target,
                sourceKey: [...throughRelation.sourceKey],
                targetKey: [...throughRelation.targetKey],
                through: {
                    relation: throughRelation,
                    throughSourceKey: throughTargetKey,
                    throughTargetKey: throughForeignKey,
                },
            });
        },
    };
    return table;
}
export function timestampSchema() {
    return {
        '~standard': {
            version: 1,
            vendor: 'data-table',
            validate(value) {
                if (value instanceof Date) {
                    return { value };
                }
                if (typeof value === 'string' || typeof value === 'number') {
                    return { value };
                }
                return {
                    issues: [
                        {
                            message: 'Expected Date, string, or number',
                        },
                    ],
                };
            },
        },
    };
}
let DEFAULT_TIMESTAMP_SCHEMA = timestampSchema();
export function timestamps(schema = DEFAULT_TIMESTAMP_SCHEMA) {
    return {
        created_at: schema,
        updated_at: schema,
    };
}
export function getPrimaryKeyObject(table, value) {
    let keys = table.primaryKey;
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
            throw new Error('Missing key "' + key + '" for primary key lookup on "' + table.name + '"');
        }
        ;
        output[key] = objectValue[key];
    }
    return output;
}
export function getCompositeKey(row, columns) {
    let values = columns.map((column) => stableSerialize(row[column]));
    return values.join('::');
}
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
    if (selector === undefined) {
        return [...defaultValue];
    }
    let keys = Array.isArray(selector) ? [...selector] : [selector];
    if (keys.length === 0) {
        throw new Error('Option "' + optionName + '" for table "' + table.name + '" must not be empty');
    }
    for (let key of keys) {
        if (!Object.prototype.hasOwnProperty.call(table.columns, key)) {
            throw new Error('Unknown column "' +
                key +
                '" in option "' +
                optionName +
                '" for table "' +
                table.name +
                '"');
        }
    }
    return keys;
}
function normalizeStringKeysForTable(table, selector, optionName, defaultValue) {
    if (selector === undefined) {
        return [...defaultValue];
    }
    let keys = Array.isArray(selector) ? [...selector] : [selector];
    if (keys.length === 0) {
        throw new Error('Option "' + optionName + '" for table "' + table.name + '" must not be empty');
    }
    for (let key of keys) {
        if (!Object.prototype.hasOwnProperty.call(table.columns, key)) {
            throw new Error('Unknown column "' +
                key +
                '" in option "' +
                optionName +
                '" for table "' +
                table.name +
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
        return { ...DEFAULT_TIMESTAMP_CONFIG };
    }
    return {
        createdAt: options.createdAt ?? DEFAULT_TIMESTAMP_CONFIG.createdAt,
        updatedAt: options.updatedAt ?? DEFAULT_TIMESTAMP_CONFIG.updatedAt,
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
        name: options.name,
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
                orderBy: [...relation.modifiers.orderBy, { column, direction }],
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
    });
}
