export function compileSqliteStatement(statement) {
    if (statement.kind === 'raw') {
        return {
            text: statement.sql.text,
            values: [...statement.sql.values],
        };
    }
    let context = { values: [] };
    if (statement.kind === 'select') {
        let selection = '*';
        if (statement.select !== '*') {
            selection = statement.select
                .map((field) => quotePath(field.column) + ' as ' + quoteIdentifier(field.alias))
                .join(', ');
        }
        return {
            text: 'select ' +
                (statement.distinct ? 'distinct ' : '') +
                selection +
                compileFromClause(statement.table, statement.joins, context) +
                compileWhereClause(statement.where, context) +
                compileGroupByClause(statement.groupBy) +
                compileHavingClause(statement.having, context) +
                compileOrderByClause(statement.orderBy) +
                compileLimitClause(statement.limit) +
                compileOffsetClause(statement.offset),
            values: context.values,
        };
    }
    if (statement.kind === 'count' || statement.kind === 'exists') {
        let inner = 'select 1' +
            compileFromClause(statement.table, statement.joins, context) +
            compileWhereClause(statement.where, context) +
            compileGroupByClause(statement.groupBy) +
            compileHavingClause(statement.having, context);
        return {
            text: 'select count(*) as ' +
                quoteIdentifier('count') +
                ' from (' +
                inner +
                ') as ' +
                quoteIdentifier('__dt_count'),
            values: context.values,
        };
    }
    if (statement.kind === 'insert') {
        return compileInsertStatement(statement.table, statement.values, statement.returning, context);
    }
    if (statement.kind === 'insertMany') {
        return compileInsertManyStatement(statement.table, statement.values, statement.returning, context);
    }
    if (statement.kind === 'update') {
        let columns = Object.keys(statement.changes);
        return {
            text: 'update ' +
                quoteIdentifier(statement.table.name) +
                ' set ' +
                columns
                    .map((column) => quotePath(column) + ' = ' + pushValue(context, statement.changes[column]))
                    .join(', ') +
                compileWhereClause(statement.where, context) +
                compileReturningClause(statement.returning),
            values: context.values,
        };
    }
    if (statement.kind === 'delete') {
        return {
            text: 'delete from ' +
                quoteIdentifier(statement.table.name) +
                compileWhereClause(statement.where, context) +
                compileReturningClause(statement.returning),
            values: context.values,
        };
    }
    if (statement.kind === 'upsert') {
        return compileUpsertStatement(statement, context);
    }
    throw new Error('Unsupported statement kind');
}
function compileInsertStatement(table, values, returning, context) {
    let columns = Object.keys(values);
    if (columns.length === 0) {
        return {
            text: 'insert into ' +
                quoteIdentifier(table.name) +
                ' default values' +
                compileReturningClause(returning),
            values: context.values,
        };
    }
    return {
        text: 'insert into ' +
            quoteIdentifier(table.name) +
            ' (' +
            columns.map((column) => quotePath(column)).join(', ') +
            ') values (' +
            columns.map((column) => pushValue(context, values[column])).join(', ') +
            ')' +
            compileReturningClause(returning),
        values: context.values,
    };
}
function compileInsertManyStatement(table, rows, returning, context) {
    if (rows.length === 0) {
        return {
            text: 'select 0 where 1 = 0',
            values: context.values,
        };
    }
    let columns = collectColumns(rows);
    if (columns.length === 0) {
        return {
            text: 'insert into ' +
                quoteIdentifier(table.name) +
                ' default values' +
                compileReturningClause(returning),
            values: context.values,
        };
    }
    return {
        text: 'insert into ' +
            quoteIdentifier(table.name) +
            ' (' +
            columns.map((column) => quotePath(column)).join(', ') +
            ') values ' +
            rows
                .map((row) => '(' +
                columns
                    .map((column) => {
                    let value = Object.prototype.hasOwnProperty.call(row, column) ? row[column] : null;
                    return pushValue(context, value);
                })
                    .join(', ') +
                ')')
                .join(', ') +
            compileReturningClause(returning),
        values: context.values,
    };
}
function compileUpsertStatement(statement, context) {
    let insertColumns = Object.keys(statement.values);
    let conflictTarget = statement.conflictTarget ?? [...statement.table.primaryKey];
    if (insertColumns.length === 0) {
        throw new Error('upsert requires at least one value');
    }
    let updateValues = statement.update ?? statement.values;
    let updateColumns = Object.keys(updateValues);
    let conflictClause = '';
    if (updateColumns.length === 0) {
        conflictClause =
            ' on conflict (' +
                conflictTarget.map((column) => quotePath(column)).join(', ') +
                ') do nothing';
    }
    else {
        conflictClause =
            ' on conflict (' +
                conflictTarget.map((column) => quotePath(column)).join(', ') +
                ') do update set ' +
                updateColumns
                    .map((column) => quotePath(column) + ' = ' + pushValue(context, updateValues[column]))
                    .join(', ');
    }
    return {
        text: 'insert into ' +
            quoteIdentifier(statement.table.name) +
            ' (' +
            insertColumns.map((column) => quotePath(column)).join(', ') +
            ') values (' +
            insertColumns.map((column) => pushValue(context, statement.values[column])).join(', ') +
            ')' +
            conflictClause +
            compileReturningClause(statement.returning),
        values: context.values,
    };
}
function compileFromClause(table, joins, context) {
    let output = ' from ' + quoteIdentifier(table.name);
    for (let join of joins) {
        output +=
            ' ' +
                normalizeJoinType(join.type) +
                ' join ' +
                quoteIdentifier(join.table.name) +
                ' on ' +
                compilePredicate(join.on, context);
    }
    return output;
}
function compileWhereClause(predicates, context) {
    if (predicates.length === 0) {
        return '';
    }
    return (' where ' +
        predicates.map((predicate) => '(' + compilePredicate(predicate, context) + ')').join(' and '));
}
function compileGroupByClause(columns) {
    if (columns.length === 0) {
        return '';
    }
    return ' group by ' + columns.map((column) => quotePath(column)).join(', ');
}
function compileHavingClause(predicates, context) {
    if (predicates.length === 0) {
        return '';
    }
    return (' having ' +
        predicates.map((predicate) => '(' + compilePredicate(predicate, context) + ')').join(' and '));
}
function compileOrderByClause(orderBy) {
    if (orderBy.length === 0) {
        return '';
    }
    return (' order by ' +
        orderBy
            .map((clause) => quotePath(clause.column) + ' ' + clause.direction.toUpperCase())
            .join(', '));
}
function compileLimitClause(limit) {
    if (limit === undefined) {
        return '';
    }
    return ' limit ' + String(limit);
}
function compileOffsetClause(offset) {
    if (offset === undefined) {
        return '';
    }
    return ' offset ' + String(offset);
}
function compileReturningClause(returning) {
    if (!returning) {
        return '';
    }
    if (returning === '*') {
        return ' returning *';
    }
    return ' returning ' + returning.map((column) => quotePath(column)).join(', ');
}
function compilePredicate(predicate, context) {
    if (predicate.type === 'comparison') {
        let column = quotePath(predicate.column);
        if (predicate.operator === 'eq') {
            if (predicate.valueType === 'value' &&
                (predicate.value === null || predicate.value === undefined)) {
                return column + ' is null';
            }
            let comparisonValue = compileComparisonValue(predicate, context);
            return column + ' = ' + comparisonValue;
        }
        if (predicate.operator === 'ne') {
            if (predicate.valueType === 'value' &&
                (predicate.value === null || predicate.value === undefined)) {
                return column + ' is not null';
            }
            let comparisonValue = compileComparisonValue(predicate, context);
            return column + ' <> ' + comparisonValue;
        }
        if (predicate.operator === 'gt') {
            let comparisonValue = compileComparisonValue(predicate, context);
            return column + ' > ' + comparisonValue;
        }
        if (predicate.operator === 'gte') {
            let comparisonValue = compileComparisonValue(predicate, context);
            return column + ' >= ' + comparisonValue;
        }
        if (predicate.operator === 'lt') {
            let comparisonValue = compileComparisonValue(predicate, context);
            return column + ' < ' + comparisonValue;
        }
        if (predicate.operator === 'lte') {
            let comparisonValue = compileComparisonValue(predicate, context);
            return column + ' <= ' + comparisonValue;
        }
        if (predicate.operator === 'in' || predicate.operator === 'notIn') {
            let values = Array.isArray(predicate.value) ? predicate.value : [];
            if (values.length === 0) {
                return predicate.operator === 'in' ? '1 = 0' : '1 = 1';
            }
            let keyword = predicate.operator === 'in' ? 'in' : 'not in';
            return (column +
                ' ' +
                keyword +
                ' (' +
                values.map((value) => pushValue(context, value)).join(', ') +
                ')');
        }
        if (predicate.operator === 'like') {
            let comparisonValue = compileComparisonValue(predicate, context);
            return column + ' like ' + comparisonValue;
        }
        if (predicate.operator === 'ilike') {
            let comparisonValue = compileComparisonValue(predicate, context);
            return 'lower(' + column + ') like lower(' + comparisonValue + ')';
        }
    }
    if (predicate.type === 'between') {
        return (quotePath(predicate.column) +
            ' between ' +
            pushValue(context, predicate.lower) +
            ' and ' +
            pushValue(context, predicate.upper));
    }
    if (predicate.type === 'null') {
        return (quotePath(predicate.column) + (predicate.operator === 'isNull' ? ' is null' : ' is not null'));
    }
    if (predicate.type === 'logical') {
        if (predicate.predicates.length === 0) {
            return predicate.operator === 'and' ? '1 = 1' : '1 = 0';
        }
        let joiner = predicate.operator === 'and' ? ' and ' : ' or ';
        return predicate.predicates
            .map((child) => '(' + compilePredicate(child, context) + ')')
            .join(joiner);
    }
    throw new Error('Unsupported predicate');
}
function compileComparisonValue(predicate, context) {
    if (predicate.valueType === 'column') {
        return quotePath(predicate.value);
    }
    return pushValue(context, predicate.value);
}
function normalizeJoinType(type) {
    if (type === 'left') {
        return 'left';
    }
    if (type === 'right') {
        return 'right';
    }
    return 'inner';
}
function quoteIdentifier(value) {
    return '"' + value.replace(/"/g, '""') + '"';
}
function quotePath(path) {
    if (path === '*') {
        return '*';
    }
    return path
        .split('.')
        .map((segment) => {
        if (segment === '*') {
            return '*';
        }
        return quoteIdentifier(segment);
    })
        .join('.');
}
function pushValue(context, value) {
    context.values.push(normalizeBoundValue(value));
    return '?';
}
function normalizeBoundValue(value) {
    if (typeof value === 'boolean') {
        return value ? 1 : 0;
    }
    return value;
}
function collectColumns(rows) {
    let columns = [];
    let seen = new Set();
    for (let row of rows) {
        for (let key in row) {
            if (!Object.prototype.hasOwnProperty.call(row, key)) {
                continue;
            }
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            columns.push(key);
        }
    }
    return columns;
}
