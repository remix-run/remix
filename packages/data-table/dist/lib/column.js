import { toTableRef } from "./migrations/helpers.js";
/**
 * Chainable builder used to describe physical column definitions.
 */
export class ColumnBuilder {
    #definition;
    constructor(definition) {
        this.#definition = definition;
    }
    /**
     * Marks the column as nullable.
     * @returns The column builder with `null` added to its output type.
     */
    nullable() {
        this.#definition.nullable = true;
        return this;
    }
    /**
     * Marks the column as non-nullable.
     * @returns The column builder with `null` removed from its output type.
     */
    notNull() {
        this.#definition.nullable = false;
        return this;
    }
    /**
     * Sets a literal default value for the column.
     * @param value Default value to apply when the column is omitted.
     * @returns The column builder.
     */
    default(value) {
        this.#definition.default = {
            kind: 'literal',
            value,
        };
        return this;
    }
    /**
     * Sets the column default to the current timestamp at write time.
     * @returns The column builder.
     */
    defaultNow() {
        this.#definition.default = {
            kind: 'now',
        };
        return this;
    }
    /**
     * Sets a raw SQL expression as the column default.
     * @param expression SQL expression used as the default value.
     * @returns The column builder.
     */
    defaultSql(expression) {
        this.#definition.default = {
            kind: 'sql',
            expression,
        };
        return this;
    }
    /**
     * Marks the column as part of the primary key.
     * @returns The column builder.
     */
    primaryKey() {
        this.#definition.primaryKey = true;
        return this;
    }
    /**
     * Marks the column as unique.
     * @param name Optional constraint name.
     * @returns The column builder.
     */
    unique(name) {
        this.#definition.unique = name ? { name } : true;
        return this;
    }
    references(table, columnsOrName, maybeName) {
        let columns = maybeName === undefined ? 'id' : columnsOrName;
        let name = maybeName === undefined ? String(columnsOrName) : maybeName;
        this.#definition.references = {
            table: toTableRef(table),
            columns: Array.isArray(columns) ? [...columns] : [columns],
            onDelete: this.#definition.references?.onDelete,
            onUpdate: this.#definition.references?.onUpdate,
            name,
        };
        return this;
    }
    /**
     * Sets the foreign-key action used when the referenced row is deleted.
     * @param action Delete action to apply.
     * @returns The column builder.
     */
    onDelete(action) {
        if (!this.#definition.references) {
            throw new Error('onDelete() requires references() to be set first');
        }
        this.#definition.references.onDelete = action;
        return this;
    }
    /**
     * Sets the foreign-key action used when the referenced row is updated.
     * @param action Update action to apply.
     * @returns The column builder.
     */
    onUpdate(action) {
        if (!this.#definition.references) {
            throw new Error('onUpdate() requires references() to be set first');
        }
        this.#definition.references.onUpdate = action;
        return this;
    }
    /**
     * Adds a check constraint for the column.
     * @param expression SQL check expression.
     * @param name Constraint name.
     * @returns The column builder.
     */
    check(expression, name) {
        let checks = this.#definition.checks ?? [];
        checks.push({ expression, name });
        this.#definition.checks = checks;
        return this;
    }
    /**
     * Adds a database comment for the column.
     * @param text Comment text.
     * @returns The column builder.
     */
    comment(text) {
        this.#definition.comment = text;
        return this;
    }
    /**
     * Marks the column as computed from a SQL expression.
     * @param expression SQL expression for the computed value.
     * @param options Computed-column options.
     * @param options.stored Whether the computed column should be stored instead of virtual.
     * @returns The column builder.
     */
    computed(expression, options) {
        this.#definition.computed = {
            expression,
            stored: options?.stored ?? true,
        };
        return this;
    }
    /**
     * Marks the column as unsigned when the dialect supports it.
     * @returns The column builder.
     */
    unsigned() {
        this.#definition.unsigned = true;
        return this;
    }
    /**
     * Marks the column as auto-incrementing when the dialect supports it.
     * @returns The column builder.
     */
    autoIncrement() {
        this.#definition.autoIncrement = true;
        return this;
    }
    /**
     * Configures an identity column strategy when the dialect supports it.
     * @param options Identity sequence options.
     * @returns The column builder.
     */
    identity(options) {
        this.#definition.identity = options ?? {};
        return this;
    }
    /**
     * Sets the collation for the column.
     * @param name Collation name.
     * @returns The column builder.
     */
    collate(name) {
        this.#definition.collate = name;
        return this;
    }
    /**
     * Sets the character set for the column.
     * @param name Character set name.
     * @returns The column builder.
     */
    charset(name) {
        this.#definition.charset = name;
        return this;
    }
    /**
     * Sets the column length.
     * @param value Maximum length value.
     * @returns The column builder.
     */
    length(value) {
        this.#definition.length = value;
        return this;
    }
    /**
     * Sets numeric precision and optional scale for the column.
     * @param value Precision value.
     * @param scale Optional scale value.
     * @returns The column builder.
     */
    precision(value, scale) {
        this.#definition.precision = value;
        if (scale !== undefined) {
            this.#definition.scale = scale;
        }
        return this;
    }
    /**
     * Sets numeric scale for the column.
     * @param value Scale value.
     * @returns The column builder.
     */
    scale(value) {
        this.#definition.scale = value;
        return this;
    }
    /**
     * Enables or disables timezone support for time-based columns.
     * @param enabled Whether timezone support should be enabled.
     * @returns The column builder.
     */
    timezone(enabled = true) {
        this.#definition.withTimezone = enabled;
        return this;
    }
    /**
     * Builds the immutable column definition.
     * @returns A normalized column definition.
     */
    build() {
        return {
            ...this.#definition,
            checks: this.#definition.checks ? [...this.#definition.checks] : undefined,
        };
    }
}
function createColumnBuilder(type) {
    return new ColumnBuilder({ type });
}
/**
 * Chainable column builder namespace.
 * @example
 * ```ts
 * import { column as c } from 'remix/data-table'
 *
 * let email = c.varchar(255).notNull().unique('users_email_uq')
 * ```
 */
export let column = {
    varchar(length) {
        return new ColumnBuilder({ type: 'varchar', length });
    },
    text() {
        return createColumnBuilder('text');
    },
    integer() {
        return createColumnBuilder('integer');
    },
    bigint() {
        return createColumnBuilder('bigint');
    },
    decimal(precision, scale) {
        return new ColumnBuilder({ type: 'decimal', precision, scale });
    },
    boolean() {
        return createColumnBuilder('boolean');
    },
    uuid() {
        return createColumnBuilder('uuid');
    },
    date() {
        return createColumnBuilder('date');
    },
    time(options) {
        return new ColumnBuilder({
            type: 'time',
            precision: options?.precision,
            withTimezone: options?.withTimezone,
        });
    },
    timestamp(options) {
        return new ColumnBuilder({
            type: 'timestamp',
            precision: options?.precision,
            withTimezone: options?.withTimezone,
        });
    },
    json() {
        return createColumnBuilder('json');
    },
    binary(length) {
        return new ColumnBuilder({ type: 'binary', length });
    },
    enum(values) {
        return new ColumnBuilder({ type: 'enum', enumValues: [...values] });
    },
};
