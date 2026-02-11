export class MemoryDatabaseAdapter {
    dialect = 'memory';
    capabilities;
    statements = [];
    events = [];
    #data;
    #transactions = new Map();
    #transactionCounter = 0;
    constructor(seed = {}, options) {
        this.#data = cloneData(seed);
        this.capabilities = {
            returning: options?.returning ?? true,
            savepoints: true,
            upsert: options?.upsert ?? true,
        };
    }
    async execute(request) {
        this.statements.push(request);
        let data = this.#dataForRequest(request);
        let statement = request.statement;
        if (statement.kind === 'raw') {
            return { rows: [] };
        }
        if (statement.kind === 'select') {
            let filtered = readRowsForStatement(data, statement);
            let sorted = applyOrder(filtered, statement.orderBy);
            let offsetRows = statement.offset === undefined ? sorted : sorted.slice(statement.offset);
            let limitRows = statement.limit === undefined ? offsetRows : offsetRows.slice(0, statement.limit);
            let distinctRows = statement.distinct ? distinct(limitRows) : limitRows;
            let projected = projectRows(distinctRows, statement.select);
            return { rows: projected };
        }
        if (statement.kind === 'count') {
            let filtered = readRowsForStatement(data, statement);
            return { rows: [{ count: filtered.length }] };
        }
        if (statement.kind === 'exists') {
            let filtered = readRowsForStatement(data, statement);
            return { rows: [{ exists: filtered.length > 0 }] };
        }
        if (statement.kind === 'insert') {
            let tableRows = readRows(data, statement.table);
            let row = { ...statement.values };
            let insertId = assignPrimaryKeyIfMissing(statement.table, tableRows, row);
            tableRows.push(row);
            return {
                affectedRows: 1,
                insertId,
                rows: statement.returning ? projectRows([row], statement.returning) : undefined,
            };
        }
        if (statement.kind === 'insertMany') {
            let tableRows = readRows(data, statement.table);
            let insertedRows = [];
            let lastInsertId = undefined;
            for (let values of statement.values) {
                let row = { ...values };
                lastInsertId = assignPrimaryKeyIfMissing(statement.table, tableRows, row);
                tableRows.push(row);
                insertedRows.push(row);
            }
            return {
                affectedRows: statement.values.length,
                insertId: lastInsertId,
                rows: statement.returning ? projectRows(insertedRows, statement.returning) : undefined,
            };
        }
        if (statement.kind === 'update') {
            let tableRows = readRows(data, statement.table);
            let matches = tableRows.filter((row) => matchesPredicateList(row, statement.where));
            for (let row of matches) {
                Object.assign(row, statement.changes);
            }
            return {
                affectedRows: matches.length,
                rows: statement.returning ? projectRows(matches, statement.returning) : undefined,
            };
        }
        if (statement.kind === 'delete') {
            let tableRows = readRows(data, statement.table);
            let remainingRows = [];
            let deletedRows = [];
            for (let row of tableRows) {
                if (matchesPredicateList(row, statement.where)) {
                    deletedRows.push(row);
                }
                else {
                    remainingRows.push(row);
                }
            }
            data[statement.table.name] = remainingRows;
            return {
                affectedRows: deletedRows.length,
                rows: statement.returning ? projectRows(deletedRows, statement.returning) : undefined,
            };
        }
        if (statement.kind === 'upsert') {
            let tableRows = readRows(data, statement.table);
            let conflictTarget = statement.conflictTarget ?? [...statement.table.primaryKey];
            let existing = tableRows.find((row) => conflictTarget.every((key) => row[key] === statement.values[key]));
            if (existing) {
                let updateValues = statement.update ?? statement.values;
                Object.assign(existing, updateValues);
                return {
                    affectedRows: 1,
                    rows: statement.returning ? projectRows([existing], statement.returning) : undefined,
                };
            }
            let insertedRow = { ...statement.values };
            let insertId = assignPrimaryKeyIfMissing(statement.table, tableRows, insertedRow);
            tableRows.push(insertedRow);
            return {
                affectedRows: 1,
                insertId,
                rows: statement.returning ? projectRows([insertedRow], statement.returning) : undefined,
            };
        }
        throw new Error('Unknown statement kind');
    }
    async beginTransaction() {
        this.#transactionCounter += 1;
        let id = 'tx_' + String(this.#transactionCounter);
        this.events.push('begin:' + id);
        this.#transactions.set(id, {
            data: cloneData(this.#data),
            savepoints: new Map(),
        });
        return { id };
    }
    async commitTransaction(token) {
        let transaction = this.#transactions.get(token.id);
        if (!transaction) {
            throw new Error('Unknown transaction token: ' + token.id);
        }
        this.#data = transaction.data;
        this.#transactions.delete(token.id);
        this.events.push('commit:' + token.id);
    }
    async rollbackTransaction(token) {
        let deleted = this.#transactions.delete(token.id);
        if (!deleted) {
            throw new Error('Unknown transaction token: ' + token.id);
        }
        this.events.push('rollback:' + token.id);
    }
    async createSavepoint(token, name) {
        let transaction = this.#transactions.get(token.id);
        if (!transaction) {
            throw new Error('Unknown transaction token: ' + token.id);
        }
        transaction.savepoints.set(name, cloneData(transaction.data));
        this.events.push('savepoint:' + token.id + ':' + name);
    }
    async rollbackToSavepoint(token, name) {
        let transaction = this.#transactions.get(token.id);
        if (!transaction) {
            throw new Error('Unknown transaction token: ' + token.id);
        }
        let snapshot = transaction.savepoints.get(name);
        if (!snapshot) {
            throw new Error('Unknown savepoint: ' + name);
        }
        transaction.data = cloneData(snapshot);
        this.events.push('rollback-to-savepoint:' + token.id + ':' + name);
    }
    async releaseSavepoint(token, name) {
        let transaction = this.#transactions.get(token.id);
        if (!transaction) {
            throw new Error('Unknown transaction token: ' + token.id);
        }
        transaction.savepoints.delete(name);
        this.events.push('release-savepoint:' + token.id + ':' + name);
    }
    seed(data) {
        this.#data = cloneData(data);
    }
    snapshot(tableName) {
        return cloneData(this.#data)[tableName] ?? [];
    }
    clear() {
        this.#data = {};
        this.#transactions.clear();
        this.statements = [];
        this.events = [];
    }
    #dataForRequest(request) {
        if (!request.transaction) {
            return this.#data;
        }
        let transaction = this.#transactions.get(request.transaction.id);
        if (!transaction) {
            throw new Error('Unknown transaction token: ' + request.transaction.id);
        }
        return transaction.data;
    }
}
export function createMemoryDatabaseAdapter(seed = {}, options) {
    return new MemoryDatabaseAdapter(seed, options);
}
function readRows(data, table) {
    if (!data[table.name]) {
        data[table.name] = [];
    }
    return data[table.name];
}
function applyWhere(rows, predicates) {
    return rows.filter((row) => matchesPredicateList(row, predicates));
}
function matchesPredicateList(row, predicates) {
    for (let predicate of predicates) {
        if (!matchesPredicate(row, predicate)) {
            return false;
        }
    }
    return true;
}
function matchesPredicate(row, predicate) {
    if (predicate.type === 'comparison') {
        let rowValue = readRowValue(row, predicate.column);
        let comparisonValue = predicate.valueType === 'column' ? readRowValue(row, predicate.value) : predicate.value;
        if (predicate.operator === 'eq') {
            return rowValue === comparisonValue;
        }
        if (predicate.operator === 'ne') {
            return rowValue !== comparisonValue;
        }
        if (predicate.operator === 'gt') {
            return compareValues(rowValue, comparisonValue) > 0;
        }
        if (predicate.operator === 'gte') {
            return compareValues(rowValue, comparisonValue) >= 0;
        }
        if (predicate.operator === 'lt') {
            return compareValues(rowValue, comparisonValue) < 0;
        }
        if (predicate.operator === 'lte') {
            return compareValues(rowValue, comparisonValue) <= 0;
        }
        if (predicate.operator === 'in') {
            return Array.isArray(predicate.value) && predicate.value.includes(rowValue);
        }
        if (predicate.operator === 'notIn') {
            return Array.isArray(predicate.value) && !predicate.value.includes(rowValue);
        }
        if (predicate.operator === 'like') {
            return likeMatch(String(rowValue ?? ''), String(comparisonValue), false);
        }
        if (predicate.operator === 'ilike') {
            return likeMatch(String(rowValue ?? ''), String(comparisonValue), true);
        }
    }
    if (predicate.type === 'between') {
        let rowValue = readRowValue(row, predicate.column);
        return (compareValues(rowValue, predicate.lower) >= 0 && compareValues(rowValue, predicate.upper) <= 0);
    }
    if (predicate.type === 'null') {
        if (predicate.operator === 'isNull') {
            let value = readRowValue(row, predicate.column);
            return value === null || value === undefined;
        }
        let value = readRowValue(row, predicate.column);
        return value !== null && value !== undefined;
    }
    if (predicate.type === 'logical') {
        if (predicate.operator === 'and') {
            return predicate.predicates.every((child) => matchesPredicate(row, child));
        }
        return predicate.predicates.some((child) => matchesPredicate(row, child));
    }
    return false;
}
function readRowValue(row, path) {
    if (Object.prototype.hasOwnProperty.call(row, path)) {
        return row[path];
    }
    let dotIndex = path.indexOf('.');
    if (dotIndex === -1) {
        return row[path];
    }
    if (rowHasQualifiedColumns(row)) {
        return undefined;
    }
    let column = path.slice(dotIndex + 1);
    return row[column];
}
function rowHasQualifiedColumns(row) {
    for (let key of Object.keys(row)) {
        if (key.includes('.')) {
            return true;
        }
    }
    return false;
}
function compareValues(left, right) {
    if (left === right) {
        return 0;
    }
    if (left === undefined || left === null) {
        return -1;
    }
    if (right === undefined || right === null) {
        return 1;
    }
    if (left instanceof Date && right instanceof Date) {
        return left.getTime() - right.getTime();
    }
    if (typeof left === 'number' && typeof right === 'number') {
        return left - right;
    }
    return String(left).localeCompare(String(right));
}
function likeMatch(value, pattern, caseInsensitive) {
    let escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    let regexPattern = '^' + escaped.replace(/%/g, '.*').replace(/_/g, '.') + '$';
    let regex = new RegExp(regexPattern, caseInsensitive ? 'i' : undefined);
    return regex.test(value);
}
function applyOrder(rows, orderBy) {
    if (orderBy.length === 0) {
        return [...rows];
    }
    return [...rows].sort((left, right) => {
        for (let clause of orderBy) {
            let direction = clause.direction === 'desc' ? -1 : 1;
            let comparison = compareValues(readRowValue(left, clause.column), readRowValue(right, clause.column));
            if (comparison !== 0) {
                return comparison * direction;
            }
        }
        return 0;
    });
}
function distinct(rows) {
    let seen = new Set();
    let output = [];
    for (let row of rows) {
        let key = JSON.stringify(row);
        if (!seen.has(key)) {
            seen.add(key);
            output.push(row);
        }
    }
    return output;
}
function projectRows(rows, select) {
    if (select === '*') {
        return rows.map((row) => ({ ...row }));
    }
    if (select.length > 0 && typeof select[0] === 'string') {
        let columns = select;
        return rows.map((row) => {
            let output = {};
            for (let column of columns) {
                output[column] = readRowValue(row, column);
            }
            return output;
        });
    }
    let fields = select;
    return rows.map((row) => {
        let output = {};
        for (let field of fields) {
            output[field.alias] = readRowValue(row, field.column);
        }
        return output;
    });
}
function assignPrimaryKeyIfMissing(table, rows, row) {
    if (table.primaryKey.length !== 1) {
        return undefined;
    }
    let key = table.primaryKey[0];
    if (row[key] !== undefined) {
        return row[key];
    }
    let highest = 0;
    for (let current of rows) {
        let value = current[key];
        if (typeof value === 'number' && value > highest) {
            highest = value;
        }
    }
    let nextId = highest + 1;
    row[key] = nextId;
    return nextId;
}
function cloneData(data) {
    return structuredClone(data);
}
function readRowsForStatement(data, statement) {
    let sourceRows = readRows(data, statement.table);
    let joinedRows = statement.joins.length === 0
        ? sourceRows.map((row) => ({ ...row }))
        : applyJoins(sourceRows, statement.table, statement.joins, data);
    let filteredRows = applyWhere(joinedRows, statement.where);
    let groupedRows = applyGroupBy(filteredRows, statement.groupBy);
    return applyWhere(groupedRows, statement.having);
}
function applyJoins(sourceRows, sourceTable, joins, data) {
    let currentRows = sourceRows.map((row) => mergeTableData({}, sourceTable, row));
    for (let join of joins) {
        let targetRows = readRows(data, join.table);
        let nextRows = [];
        let matchedTargetIndexes = new Set();
        let nullLeftRow = currentRows[0] ? createNullRow(currentRows[0]) : {};
        for (let leftRow of currentRows) {
            let matched = false;
            let targetIndex = 0;
            while (targetIndex < targetRows.length) {
                let candidate = mergeTableData(leftRow, join.table, targetRows[targetIndex]);
                if (matchesPredicate(candidate, join.on)) {
                    matched = true;
                    matchedTargetIndexes.add(targetIndex);
                    nextRows.push(candidate);
                }
                targetIndex += 1;
            }
            if (!matched && (join.type === 'left' || join.type === 'full')) {
                nextRows.push(mergeTableData(leftRow, join.table));
            }
        }
        if (join.type === 'right' || join.type === 'full') {
            let targetIndex = 0;
            while (targetIndex < targetRows.length) {
                if (!matchedTargetIndexes.has(targetIndex)) {
                    nextRows.push(mergeTableData(nullLeftRow, join.table, targetRows[targetIndex]));
                }
                targetIndex += 1;
            }
        }
        currentRows = nextRows;
    }
    return currentRows;
}
function applyGroupBy(rows, groupBy) {
    if (groupBy.length === 0) {
        return rows;
    }
    let output = [];
    let seen = new Set();
    for (let row of rows) {
        let key = JSON.stringify(groupBy.map((column) => readRowValue(row, column)));
        if (!seen.has(key)) {
            seen.add(key);
            output.push(row);
        }
    }
    return output;
}
function mergeTableData(base, table, row) {
    let output = { ...base };
    for (let column of Object.keys(table.columns)) {
        let value = row ? row[column] : undefined;
        let qualifiedColumn = table.name + '.' + column;
        output[qualifiedColumn] = value;
        if (!Object.prototype.hasOwnProperty.call(output, column)) {
            output[column] = value;
        }
    }
    return output;
}
function createNullRow(template) {
    let output = {};
    for (let key of Object.keys(template)) {
        output[key] = undefined;
    }
    return output;
}
