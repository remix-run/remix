import { DataTableQueryError } from "../errors.js";
import { and, eq, inList, or } from "../operators.js";
import { query as createQuery } from "../query.js";
import { getPrimaryKeyObject, getTableName, getTablePrimaryKey } from "../table.js";
import { loadRowsWithRelationsForQuery } from "./query-execution.js";
export function asQueryTableInput(table) {
    return table;
}
export function getPrimaryKeyWhere(table, value) {
    return getPrimaryKeyObject(table, value);
}
export function getPrimaryKeyWhereFromRow(table, row) {
    let where = {};
    for (let key of getTablePrimaryKey(table)) {
        where[key] = row[key];
    }
    return where;
}
export function resolveCreateRowWhere(table, values, insertId) {
    let primaryKey = getTablePrimaryKey(table);
    if (primaryKey.length === 1) {
        let key = primaryKey[0];
        if (Object.prototype.hasOwnProperty.call(values, key)) {
            return {
                [key]: values[key],
            };
        }
        if (insertId !== undefined) {
            return {
                [key]: insertId,
            };
        }
    }
    let where = {};
    for (let key of primaryKey) {
        if (!Object.prototype.hasOwnProperty.call(values, key)) {
            throw new DataTableQueryError('create({ returnRow: true }) requires primary key values for table "' +
                getTableName(table) +
                '" when adapter does not support RETURNING');
        }
        where[key] = values[key];
    }
    return where;
}
export function normalizeOrderByInput(input) {
    if (!input) {
        return [];
    }
    if (input.length === 0) {
        return [];
    }
    if (Array.isArray(input[0])) {
        return input;
    }
    return [input];
}
export function toWriteResult(result) {
    return {
        affectedRows: result.affectedRows,
        insertId: result.insertId,
    };
}
export function hasScopedWriteModifiers(state) {
    return state.orderBy.length > 0 || state.limit !== undefined || state.offset !== undefined;
}
export async function loadPrimaryKeyRowsForScope(database, table, state) {
    let query = createQuery(table);
    for (let predicate of state.where) {
        query = query.where(predicate);
    }
    for (let clause of state.orderBy) {
        query = query.orderBy(clause.column, clause.direction);
    }
    if (state.limit !== undefined) {
        query = query.limit(state.limit);
    }
    if (state.offset !== undefined) {
        query = query.offset(state.offset);
    }
    let rows = await loadRowsWithRelationsForQuery(database, query.select(...getTablePrimaryKey(table)));
    let primaryKeys = getTablePrimaryKey(table);
    return rows.map((row) => {
        let keyObject = {};
        for (let key of rowKeys(row, primaryKeys)) {
            keyObject[key] = row[key];
        }
        return keyObject;
    });
}
export function buildPrimaryKeyPredicate(table, keyObjects) {
    let primaryKey = getTablePrimaryKey(table);
    if (keyObjects.length === 0) {
        return undefined;
    }
    if (primaryKey.length === 1) {
        let key = primaryKey[0];
        return inList(key, keyObjects.map((objectValue) => objectValue[key]));
    }
    let predicates = keyObjects.map((objectValue) => {
        let comparisons = primaryKey.map((key) => {
            let typedKey = key;
            return eq(typedKey, objectValue[typedKey]);
        });
        return and(...comparisons);
    });
    return or(...predicates);
}
function rowKeys(row, keys) {
    let output = [];
    for (let key of keys) {
        if (Object.prototype.hasOwnProperty.call(row, key)) {
            output.push(key);
        }
    }
    return output;
}
