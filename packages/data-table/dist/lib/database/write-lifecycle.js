import { DataTableQueryError, DataTableValidationError } from "../errors.js";
import { getTableAfterDelete, getTableAfterRead, getTableAfterWrite, getTableBeforeDelete, getTableBeforeWrite, getTableColumns, getTableName, getTableTimestamps, getTableValidator, } from "../table.js";
export function prepareInsertValues(table, values, now, touch) {
    let output = validateWriteValues(table, values, 'create');
    let timestamps = getTableTimestamps(table);
    let columns = getTableColumns(table);
    if (touch && timestamps) {
        let createdAt = timestamps.createdAt;
        let updatedAt = timestamps.updatedAt;
        if (Object.prototype.hasOwnProperty.call(columns, createdAt) &&
            output[createdAt] === undefined) {
            output[createdAt] = now;
        }
        if (Object.prototype.hasOwnProperty.call(columns, updatedAt) &&
            output[updatedAt] === undefined) {
            output[updatedAt] = now;
        }
    }
    return output;
}
export function prepareUpdateValues(table, values, now, touch, operation = 'update') {
    let output = validateWriteValues(table, values, operation);
    let timestamps = getTableTimestamps(table);
    let columns = getTableColumns(table);
    if (touch && timestamps) {
        let updatedAt = timestamps.updatedAt;
        if (Object.prototype.hasOwnProperty.call(columns, updatedAt) &&
            output[updatedAt] === undefined) {
            output[updatedAt] = now;
        }
    }
    return output;
}
export function applyAfterReadHooksToRows(table, rows) {
    let callback = getTableAfterRead(table);
    if (!callback || rows.length === 0) {
        return rows;
    }
    let tableName = getTableName(table);
    return rows.map((row) => {
        let callbackResult = callback({
            tableName,
            value: row,
        });
        assertSynchronousCallbackResult(tableName, 'read', 'afterRead', callbackResult);
        if (hasIssues(callbackResult)) {
            throwValidationIssues(tableName, callbackResult.issues, 'read', 'afterRead');
        }
        if (!hasValue(callbackResult)) {
            throw new DataTableValidationError('Invalid afterRead callback result for table "' + tableName + '"', [{ message: 'Expected afterRead to return { value } or { issues }' }], {
                metadata: {
                    table: tableName,
                    operation: 'read',
                    source: 'afterRead',
                },
            });
        }
        return normalizeReadObject(tableName, callbackResult.value);
    });
}
export function applyAfterReadHooksToLoadedRows(table, rows, relationMap) {
    if (rows.length === 0) {
        return rows;
    }
    let relationNames = Object.keys(relationMap);
    if (relationNames.length > 0) {
        for (let row of rows) {
            for (let relationName of relationNames) {
                let relation = relationMap[relationName];
                let relationValue = row[relationName];
                if (relation.cardinality === 'many') {
                    if (!Array.isArray(relationValue)) {
                        continue;
                    }
                    row[relationName] = applyAfterReadHooksToLoadedRows(relation.targetTable, relationValue, relation.modifiers.with);
                    continue;
                }
                if (relationValue === null || relationValue === undefined) {
                    continue;
                }
                if (typeof relationValue !== 'object' || Array.isArray(relationValue)) {
                    continue;
                }
                let transformed = applyAfterReadHooksToLoadedRows(relation.targetTable, [relationValue], relation.modifiers.with);
                row[relationName] = transformed[0] ?? null;
            }
        }
    }
    return applyAfterReadHooksToRows(table, rows);
}
export function runBeforeDeleteHook(table, context) {
    let callback = getTableBeforeDelete(table);
    if (!callback) {
        return;
    }
    let callbackResult = callback(context);
    assertSynchronousCallbackResult(context.tableName, 'delete', 'beforeDelete', callbackResult);
    if (callbackResult === undefined) {
        return;
    }
    if (hasIssues(callbackResult)) {
        throwValidationIssues(context.tableName, callbackResult.issues, 'delete', 'beforeDelete');
    }
    throw new DataTableValidationError('Invalid beforeDelete callback result for table "' + context.tableName + '"', [{ message: 'Expected beforeDelete to return nothing or { issues }' }], {
        metadata: {
            table: context.tableName,
            operation: 'delete',
            source: 'beforeDelete',
        },
    });
}
export function runAfterWriteHook(table, context) {
    let callback = getTableAfterWrite(table);
    if (!callback) {
        return;
    }
    let callbackResult = callback(context);
    assertSynchronousCallbackResult(context.tableName, context.operation, 'afterWrite', callbackResult);
}
export function runAfterDeleteHook(table, context) {
    let callback = getTableAfterDelete(table);
    if (!callback) {
        return;
    }
    let callbackResult = callback(context);
    assertSynchronousCallbackResult(context.tableName, 'delete', 'afterDelete', callbackResult);
}
export function assertReturningCapability(adapter, operation, returning) {
    if (returning && !adapter.capabilities.returning) {
        throw new DataTableQueryError(operation + '() returning is not supported by this adapter');
    }
}
export function normalizeReturningSelection(returning) {
    if (returning === '*') {
        return '*';
    }
    return [...returning];
}
function validateWriteValues(table, values, operation) {
    let tableName = getTableName(table);
    let normalizedInput = normalizeWriteObject(table, values, operation);
    let beforeWrite = getTableBeforeWrite(table);
    if (beforeWrite) {
        let beforeWriteResult = beforeWrite({
            operation,
            tableName,
            value: normalizedInput,
        });
        assertSynchronousCallbackResult(tableName, operation, 'beforeWrite', beforeWriteResult);
        if (hasIssues(beforeWriteResult)) {
            throwValidationIssues(tableName, beforeWriteResult.issues, operation, 'beforeWrite');
        }
        if (!hasValue(beforeWriteResult)) {
            throw new DataTableValidationError('Invalid beforeWrite callback result for table "' + tableName + '"', [{ message: 'Expected beforeWrite to return { value } or { issues }' }], {
                metadata: {
                    table: tableName,
                    operation,
                    source: 'beforeWrite',
                },
            });
        }
        normalizedInput = normalizeWriteObject(table, beforeWriteResult.value, operation, 'beforeWrite');
    }
    let validator = getTableValidator(table);
    if (!validator) {
        return normalizedInput;
    }
    let validationResult = validator({
        operation,
        tableName,
        value: normalizedInput,
    });
    assertSynchronousCallbackResult(tableName, operation, 'validate', validationResult);
    if (hasIssues(validationResult)) {
        throwValidationIssues(tableName, validationResult.issues, operation, 'validate');
    }
    if (!hasValue(validationResult)) {
        throw new DataTableValidationError('Invalid validator result for table "' + tableName + '"', [{ message: 'Expected validator to return { value } or { issues }' }], {
            metadata: {
                table: tableName,
                operation,
                source: 'validate',
            },
        });
    }
    return normalizeWriteObject(table, validationResult.value, operation, 'validate');
}
function hasIssues(value) {
    return typeof value === 'object' && value !== null && 'issues' in value;
}
function hasValue(value) {
    return typeof value === 'object' && value !== null && 'value' in value;
}
function normalizeWriteObject(table, value, operation, source) {
    let tableName = getTableName(table);
    let columns = getTableColumns(table);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new DataTableValidationError('Invalid value for table "' + tableName + '"', [{ message: 'Expected object' }], {
            metadata: {
                table: tableName,
                operation,
                ...(source ? { source } : {}),
            },
        });
    }
    let output = {};
    for (let key in value) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) {
            continue;
        }
        if (!Object.prototype.hasOwnProperty.call(columns, key)) {
            throw new DataTableValidationError('Unknown column "' + key + '" for table "' + tableName + '"', [], {
                metadata: {
                    table: tableName,
                    column: key,
                    operation,
                    ...(source ? { source } : {}),
                },
            });
        }
        output[key] = value[key];
    }
    return output;
}
function throwValidationIssues(tableName, issues, operation, source) {
    let firstIssue = issues[0];
    let issuePath = firstIssue?.path;
    let firstPathSegment = issuePath && issuePath.length > 0 ? issuePath[0] : undefined;
    let column = typeof firstPathSegment === 'string' ? firstPathSegment : undefined;
    if (column) {
        throw new DataTableValidationError('Invalid value for column "' + column + '" in table "' + tableName + '"', issues, {
            metadata: {
                table: tableName,
                column,
                operation,
                ...(source ? { source } : {}),
            },
        });
    }
    throw new DataTableValidationError('Invalid value for table "' + tableName + '"', issues, {
        metadata: {
            table: tableName,
            operation,
            ...(source ? { source } : {}),
        },
    });
}
function assertSynchronousCallbackResult(tableName, operation, callbackName, value) {
    if (!isPromiseLike(value)) {
        return;
    }
    throw new DataTableValidationError('Invalid ' + callbackName + ' callback result for table "' + tableName + '"', [{ message: callbackName + ' callbacks must be synchronous and cannot return a Promise' }], {
        metadata: {
            table: tableName,
            operation,
            source: callbackName,
        },
    });
}
function isPromiseLike(value) {
    return ((typeof value === 'object' || typeof value === 'function') &&
        value !== null &&
        'then' in value &&
        typeof value.then === 'function');
}
function normalizeReadObject(tableName, value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new DataTableValidationError('Invalid afterRead callback result for table "' + tableName + '"', [{ message: 'Expected afterRead to return an object value' }], {
            metadata: {
                table: tableName,
                operation: 'read',
                source: 'afterRead',
            },
        });
    }
    return {
        ...value,
    };
}
