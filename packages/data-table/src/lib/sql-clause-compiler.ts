import type { JoinClause } from './driver.ts'
import type { Predicate } from './operators.ts'
import { compileOrderByDirection, normalizeJoinType, quotePath } from './sql-helpers.ts'
import type { QuoteIdentifier } from './sql-helpers.ts'
import type { AnyTable, OrderByClause } from './table.ts'
import { getTableName } from './table.ts'

/**
 * Values bound while compiling a single statement.
 */
export interface SqlCompileContext {
  /**
   * Bound values, in placeholder order.
   */
  values: unknown[]
}

/**
 * Dialect-specific pieces used by {@link createSqlClauseCompiler}.
 */
export interface SqlClauseDialect {
  /**
   * Quotes a single identifier segment.
   */
  quoteIdentifier: QuoteIdentifier
  /**
   * Binds a value to the statement and returns its placeholder.
   * @param context Compile context for the current statement.
   * @param value Value to bind.
   * @returns The placeholder text, such as `?` or `$1`.
   */
  bindValue(context: SqlCompileContext, value: unknown): string
  /**
   * Compiles a case-insensitive `like` comparison.
   * @param column Quoted column expression.
   * @param value Compiled comparison value (a placeholder or quoted column).
   * @returns The SQL comparison expression.
   */
  compileCaseInsensitiveLike(column: string, value: string): string
}

/**
 * Compiles the dialect-neutral clauses of select, count, update, and delete statements.
 */
export interface SqlClauseCompiler {
  /**
   * Compiles a ` from ...` clause, including joins.
   * @param table Table being queried.
   * @param joins Joins to apply.
   * @param context Compile context for the current statement.
   * @returns The SQL clause text.
   */
  from(table: AnyTable, joins: JoinClause[], context: SqlCompileContext): string
  /**
   * Compiles a ` where ...` clause, or `''` when there are no predicates.
   * @param predicates Predicates joined with `and`.
   * @param context Compile context for the current statement.
   * @returns The SQL clause text.
   */
  where(predicates: Predicate[], context: SqlCompileContext): string
  /**
   * Compiles a ` group by ...` clause, or `''` when there are no columns.
   * @param columns Columns to group by.
   * @returns The SQL clause text.
   */
  groupBy(columns: string[]): string
  /**
   * Compiles a ` having ...` clause, or `''` when there are no predicates.
   * @param predicates Predicates joined with `and`.
   * @param context Compile context for the current statement.
   * @returns The SQL clause text.
   */
  having(predicates: Predicate[], context: SqlCompileContext): string
  /**
   * Compiles an ` order by ...` clause, or `''` when there are no clauses.
   * @param orderBy Columns and directions to order by.
   * @returns The SQL clause text.
   */
  orderBy(orderBy: OrderByClause[]): string
  /**
   * Compiles a ` limit ...` clause, or `''` when `limit` is undefined.
   * @param limit Maximum number of rows.
   * @param context Compile context for the current statement.
   * @returns The SQL clause text.
   */
  limit(limit: number | undefined, context: SqlCompileContext): string
  /**
   * Compiles an ` offset ...` clause, or `''` when `offset` is undefined.
   * @param offset Number of rows to skip.
   * @param context Compile context for the current statement.
   * @returns The SQL clause text.
   */
  offset(offset: number | undefined, context: SqlCompileContext): string
  /**
   * Compiles a ` returning ...` clause, or `''` when `returning` is undefined.
   * @param returning `'*'` or the columns to return.
   * @returns The SQL clause text.
   */
  returning(returning: '*' | string[] | undefined): string
  /**
   * Compiles a single predicate expression.
   * @param predicate Predicate to compile.
   * @param context Compile context for the current statement.
   * @returns The SQL expression text.
   */
  predicate(predicate: Predicate, context: SqlCompileContext): string
}

/**
 * Creates a compiler for the SQL clauses shared by all built-in dialects.
 * @param dialect Dialect-specific quoting, binding, and comparison hooks.
 * @returns A clause compiler for the dialect.
 */
export function createSqlClauseCompiler(dialect: SqlClauseDialect): SqlClauseCompiler {
  let quote = (path: string) => quotePath(path, dialect.quoteIdentifier)

  function compilePredicateList(
    predicates: Predicate[],
    joiner: string,
    context: SqlCompileContext,
  ) {
    return predicates
      .map((predicate) => '(' + compilePredicate(predicate, context) + ')')
      .join(joiner)
  }

  function compileComparisonValue(
    predicate: Extract<Predicate, { type: 'comparison' }>,
    context: SqlCompileContext,
  ): string {
    if (predicate.valueType === 'column') {
      return quote(predicate.value)
    }

    return dialect.bindValue(context, predicate.value)
  }

  function compilePredicate(predicate: Predicate, context: SqlCompileContext): string {
    if (predicate.type === 'comparison') {
      let column = quote(predicate.column)
      let isNullValue =
        predicate.valueType === 'value' &&
        (predicate.value === null || predicate.value === undefined)

      switch (predicate.operator) {
        case 'eq':
          return isNullValue
            ? column + ' is null'
            : column + ' = ' + compileComparisonValue(predicate, context)
        case 'ne':
          return isNullValue
            ? column + ' is not null'
            : column + ' <> ' + compileComparisonValue(predicate, context)
        case 'gt':
          return column + ' > ' + compileComparisonValue(predicate, context)
        case 'gte':
          return column + ' >= ' + compileComparisonValue(predicate, context)
        case 'lt':
          return column + ' < ' + compileComparisonValue(predicate, context)
        case 'lte':
          return column + ' <= ' + compileComparisonValue(predicate, context)
        case 'in':
        case 'notIn': {
          let values = Array.isArray(predicate.value) ? predicate.value : []

          if (values.length === 0) {
            return predicate.operator === 'in' ? '1 = 0' : '1 = 1'
          }

          let placeholders = values.map((value) => dialect.bindValue(context, value))
          let keyword = predicate.operator === 'in' ? 'in' : 'not in'

          return column + ' ' + keyword + ' (' + placeholders.join(', ') + ')'
        }
        case 'like':
          return column + ' like ' + compileComparisonValue(predicate, context)
        case 'ilike':
          return dialect.compileCaseInsensitiveLike(
            column,
            compileComparisonValue(predicate, context),
          )
      }
    }

    if (predicate.type === 'between') {
      return (
        quote(predicate.column) +
        ' between ' +
        dialect.bindValue(context, predicate.lower) +
        ' and ' +
        dialect.bindValue(context, predicate.upper)
      )
    }

    if (predicate.type === 'null') {
      return (
        quote(predicate.column) + (predicate.operator === 'isNull' ? ' is null' : ' is not null')
      )
    }

    if (predicate.type === 'logical') {
      if (predicate.predicates.length === 0) {
        return predicate.operator === 'and' ? '1 = 1' : '1 = 0'
      }

      return compilePredicateList(
        predicate.predicates,
        predicate.operator === 'and' ? ' and ' : ' or ',
        context,
      )
    }

    throw new Error('Unsupported predicate')
  }

  return {
    from(table, joins, context) {
      let output = ' from ' + quote(getTableName(table))

      for (let join of joins) {
        output +=
          ' ' +
          normalizeJoinType(join.type) +
          ' join ' +
          quote(getTableName(join.table)) +
          ' on ' +
          compilePredicate(join.on, context)
      }

      return output
    },
    where(predicates, context) {
      return predicates.length === 0
        ? ''
        : ' where ' + compilePredicateList(predicates, ' and ', context)
    },
    groupBy(columns) {
      return columns.length === 0 ? '' : ' group by ' + columns.map(quote).join(', ')
    },
    having(predicates, context) {
      return predicates.length === 0
        ? ''
        : ' having ' + compilePredicateList(predicates, ' and ', context)
    },
    orderBy(orderBy) {
      if (orderBy.length === 0) {
        return ''
      }

      return (
        ' order by ' +
        orderBy
          .map((clause) => quote(clause.column) + ' ' + compileOrderByDirection(clause.direction))
          .join(', ')
      )
    },
    limit(limit, context) {
      return limit === undefined ? '' : ' limit ' + dialect.bindValue(context, limit)
    },
    offset(offset, context) {
      return offset === undefined ? '' : ' offset ' + dialect.bindValue(context, offset)
    },
    returning(returning) {
      if (!returning) {
        return ''
      }

      return ' returning ' + (returning === '*' ? '*' : returning.map(quote).join(', '))
    },
    predicate: compilePredicate,
  }
}
