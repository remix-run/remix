export function toTableRef(name) {
    let segments = name.split('.');
    if (segments.length === 1) {
        return { name };
    }
    return {
        schema: segments[0],
        name: segments.slice(1).join('.'),
    };
}
export function normalizeIndexColumns(columns) {
    return normalizeKeyColumns(columns);
}
export function normalizeKeyColumns(columns) {
    if (Array.isArray(columns)) {
        return [...columns];
    }
    return [columns];
}
function normalizeNamePart(value) {
    let normalized = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
    if (normalized.length === 0) {
        return 'item';
    }
    return normalized;
}
function tableNamePart(table) {
    if (table.schema) {
        return normalizeNamePart(table.schema + '_' + table.name);
    }
    return normalizeNamePart(table.name);
}
function hashString(value) {
    let hash = 5381;
    for (let index = 0; index < value.length; index++) {
        hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
    }
    return hash >>> 0;
}
function withNameLimit(name) {
    let limit = 63;
    if (name.length <= limit) {
        return name;
    }
    let suffix = hashString(name).toString(36).padStart(8, '0').slice(0, 8);
    return name.slice(0, limit - 9) + '_' + suffix;
}
function columnsNamePart(columns) {
    return columns.map((column) => normalizeNamePart(column)).join('_');
}
export function createPrimaryKeyName(table) {
    return withNameLimit(tableNamePart(table) + '_pk');
}
export function createUniqueName(table, columns) {
    return withNameLimit(tableNamePart(table) + '_' + columnsNamePart(columns) + '_uq');
}
export function createForeignKeyName(table, columns, references, referenceColumns) {
    let base = tableNamePart(table) +
        '_' +
        columnsNamePart(columns) +
        '_' +
        tableNamePart(references) +
        '_' +
        columnsNamePart(referenceColumns) +
        '_fk';
    return withNameLimit(base);
}
export function createCheckName(table, expression) {
    let suffix = hashString(expression).toString(36);
    return withNameLimit(tableNamePart(table) + '_chk_' + suffix);
}
export function createIndexName(table, columns) {
    return withNameLimit(tableNamePart(table) + '_' + columnsNamePart(columns) + '_idx');
}
