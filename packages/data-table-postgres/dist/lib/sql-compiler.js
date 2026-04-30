import { getTableName, getTablePrimaryKey } from '@remix-run/data-table';
import { collectColumns as collectColumnsHelper, normalizeJoinType as normalizeJoinTypeHelper, quotePath as quotePathHelper, } from '@remix-run/data-table/sql-helpers';
export function compilePostgresOperation(operation) {
    if (operation.kind === 'raw') {
        return compileRawOperation(operation.sql);
    }
    let context = { values: [] };
    if (operation.kind === 'select') {
        let selection = '*';
        if (operation.select !== '*') {
            selection = operation.select
                .map((field) => quotePath(field.column) + ' as ' + quoteIdentifier(field.alias))
                .join(', ');
        }
        let text = 'select ' +
            (operation.distinct ? 'distinct ' : '') +
            selection +
            compileFromClause(operation.table, operation.joins, context) +
            compileWhereClause(operation.where, context) +
            compileGroupByClause(operation.groupBy) +
            compileHavingClause(operation.having, context) +
            compileOrderByClause(operation.orderBy) +
            compileLimitClause(operation.limit) +
            compileOffsetClause(operation.offset);
        return {
            text,
            values: context.values,
        };
    }
    if (operation.kind === 'count' || operation.kind === 'exists') {
        let inner = 'select 1' +
            compileFromClause(operation.table, operation.joins, context) +
            compileWhereClause(operation.where, context) +
            compileGroupByClause(operation.groupBy) +
            compileHavingClause(operation.having, context);
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
    if (operation.kind === 'insert') {
        return compileInsertOperation(operation.table, operation.values, operation.returning, context);
    }
    if (operation.kind === 'insertMany') {
        return compileInsertManyOperation(operation.table, operation.values, operation.returning, context);
    }
    if (operation.kind === 'update') {
        let changes = Object.keys(operation.changes);
        let assignments = changes
            .map((column) => quotePath(column) + ' = ' + pushValue(context, operation.changes[column]))
            .join(', ');
        return {
            text: 'update ' +
                quotePath(getTableName(operation.table)) +
                ' set ' +
                assignments +
                compileWhereClause(operation.where, context) +
                compileReturningClause(operation.returning),
            values: context.values,
        };
    }
    if (operation.kind === 'delete') {
        return {
            text: 'delete from ' +
                quotePath(getTableName(operation.table)) +
                compileWhereClause(operation.where, context) +
                compileReturningClause(operation.returning),
            values: context.values,
        };
    }
    if (operation.kind === 'upsert') {
        return compileUpsertOperation(operation, context);
    }
    throw new Error('Unsupported operation kind');
}
function compileInsertOperation(table, values, returning, context) {
    let columns = Object.keys(values);
    if (columns.length === 0) {
        return {
            text: 'insert into ' +
                quotePath(getTableName(table)) +
                ' default values' +
                compileReturningClause(returning),
            values: context.values,
        };
    }
    let quotedColumns = columns.map((column) => quotePath(column));
    let placeholders = columns.map((column) => pushValue(context, values[column]));
    return {
        text: 'insert into ' +
            quotePath(getTableName(table)) +
            ' (' +
            quotedColumns.join(', ') +
            ') values (' +
            placeholders.join(', ') +
            ')' +
            compileReturningClause(returning),
        values: context.values,
    };
}
function compileInsertManyOperation(table, rows, returning, context) {
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
                quotePath(getTableName(table)) +
                ' default values' +
                compileReturningClause(returning),
            values: context.values,
        };
    }
    let quotedColumns = columns.map((column) => quotePath(column));
    let valueSets = rows.map((row) => {
        let placeholders = columns.map((column) => {
            let value = Object.prototype.hasOwnProperty.call(row, column) ? row[column] : null;
            return pushValue(context, value);
        });
        return '(' + placeholders.join(', ') + ')';
    });
    return {
        text: 'insert into ' +
            quotePath(getTableName(table)) +
            ' (' +
            quotedColumns.join(', ') +
            ') values ' +
            valueSets.join(', ') +
            compileReturningClause(returning),
        values: context.values,
    };
}
function compileUpsertOperation(operation, context) {
    let insertColumns = Object.keys(operation.values);
    let conflictTarget = operation.conflictTarget ?? [...getTablePrimaryKey(operation.table)];
    if (insertColumns.length === 0) {
        throw new Error('upsert requires at least one value');
    }
    let quotedInsertColumns = insertColumns.map((column) => quotePath(column));
    let insertPlaceholders = insertColumns.map((column) => pushValue(context, operation.values[column]));
    let updateValues = operation.update ?? operation.values;
    let updateColumns = Object.keys(updateValues);
    let onConflictClause = '';
    if (updateColumns.length === 0) {
        onConflictClause =
            ' on conflict (' +
                conflictTarget.map((column) => quotePath(column)).join(', ') +
                ') do nothing';
    }
    else {
        onConflictClause =
            ' on conflict (' +
                conflictTarget.map((column) => quotePath(column)).join(', ') +
                ') do update set ' +
                updateColumns
                    .map((column) => quotePath(column) + ' = ' + pushValue(context, updateValues[column]))
                    .join(', ');
    }
    return {
        text: 'insert into ' +
            quotePath(getTableName(operation.table)) +
            ' (' +
            quotedInsertColumns.join(', ') +
            ') values (' +
            insertPlaceholders.join(', ') +
            ')' +
            onConflictClause +
            compileReturningClause(operation.returning),
        values: context.values,
    };
}
function compileRawOperation(statement) {
    if (!statement.text.includes('?')) {
        return {
            text: statement.text,
            values: [...statement.values],
        };
    }
    let index = 1;
    let text = statement.text.replace(/\?/g, function replaceParameter() {
        let placeholder = '$' + String(index);
        index += 1;
        return placeholder;
    });
    return {
        text,
        values: [...statement.values],
    };
}
function compileFromClause(table, joins, context) {
    let output = ' from ' + quotePath(getTableName(table));
    for (let join of joins) {
        output +=
            ' ' +
                normalizeJoinType(join.type) +
                ' join ' +
                quotePath(getTableName(join.table)) +
                ' on ' +
                compilePredicate(join.on, context);
    }
    return output;
}
function compileWhereClause(predicates, context) {
    if (predicates.length === 0) {
        return '';
    }
    let where = predicates
        .map((predicate) => '(' + compilePredicate(predicate, context) + ')')
        .join(' and ');
    return ' where ' + where;
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
    let having = predicates
        .map((predicate) => '(' + compilePredicate(predicate, context) + ')')
        .join(' and ');
    return ' having ' + having;
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
            let placeholders = values.map((value) => pushValue(context, value));
            let keyword = predicate.operator === 'in' ? 'in' : 'not in';
            return column + ' ' + keyword + ' (' + placeholders.join(', ') + ')';
        }
        if (predicate.operator === 'like') {
            let comparisonValue = compileComparisonValue(predicate, context);
            return column + ' like ' + comparisonValue;
        }
        if (predicate.operator === 'ilike') {
            let comparisonValue = compileComparisonValue(predicate, context);
            return column + ' ilike ' + comparisonValue;
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
        let childOperator = predicate.operator === 'and' ? ' and ' : ' or ';
        let childPredicates = predicate.predicates
            .map((child) => '(' + compilePredicate(child, context) + ')')
            .join(childOperator);
        return childPredicates;
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
    return normalizeJoinTypeHelper(type);
}
function quoteIdentifier(value) {
    return '"' + value.replace(/"/g, '""') + '"';
}
function quotePath(path) {
    return quotePathHelper(path, quoteIdentifier);
}
function pushValue(context, value) {
    context.values.push(value);
    return '$' + String(context.values.length);
}
function collectColumns(rows) {
    return collectColumnsHelper(rows);
}
