import { toTableRef } from "./migrations/helpers.js";
/**
 * Chainable builder used to describe physical column definitions.
 */
export class ColumnBuilder {
    #definition;
    constructor(definition) {
        this.#definition = definition;
    }
    nullable() {
        this.#definition.nullable = true;
        return this;
    }
    notNull() {
        this.#definition.nullable = false;
        return this;
    }
    default(value) {
        this.#definition.default = {
            kind: 'literal',
            value,
        };
        return this;
    }
    defaultNow() {
        this.#definition.default = {
            kind: 'now',
        };
        return this;
    }
    defaultSql(expression) {
        this.#definition.default = {
            kind: 'sql',
            expression,
        };
        return this;
    }
    primaryKey() {
        this.#definition.primaryKey = true;
        return this;
    }
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
    onDelete(action) {
        if (!this.#definition.references) {
            throw new Error('onDelete() requires references() to be set first');
        }
        this.#definition.references.onDelete = action;
        return this;
    }
    onUpdate(action) {
        if (!this.#definition.references) {
            throw new Error('onUpdate() requires references() to be set first');
        }
        this.#definition.references.onUpdate = action;
        return this;
    }
    check(expression, name) {
        let checks = this.#definition.checks ?? [];
        checks.push({ expression, name });
        this.#definition.checks = checks;
        return this;
    }
    comment(text) {
        this.#definition.comment = text;
        return this;
    }
    computed(expression, options) {
        this.#definition.computed = {
            expression,
            stored: options?.stored ?? true,
        };
        return this;
    }
    unsigned() {
        this.#definition.unsigned = true;
        return this;
    }
    autoIncrement() {
        this.#definition.autoIncrement = true;
        return this;
    }
    identity(options) {
        this.#definition.identity = options ?? {};
        return this;
    }
    collate(name) {
        this.#definition.collate = name;
        return this;
    }
    charset(name) {
        this.#definition.charset = name;
        return this;
    }
    length(value) {
        this.#definition.length = value;
        return this;
    }
    precision(value, scale) {
        this.#definition.precision = value;
        if (scale !== undefined) {
            this.#definition.scale = scale;
        }
        return this;
    }
    scale(value) {
        this.#definition.scale = value;
        return this;
    }
    timezone(enabled = true) {
        this.#definition.withTimezone = enabled;
        return this;
    }
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
