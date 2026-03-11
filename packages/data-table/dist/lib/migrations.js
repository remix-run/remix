/**
 * Creates a migration descriptor with normalized defaults.
 * @param input Migration handlers and transaction mode.
 * @returns A normalized migration object.
 * @example
 * ```ts
 * import { createMigration, column as c } from 'remix/data-table/migrations'
 * import { table } from 'remix/data-table'
 *
 * let users = table({
 *   name: 'users',
 *   columns: {
 *     id: c.integer().primaryKey().autoIncrement(),
 *     email: c.varchar(255).notNull().unique(),
 *   },
 * })
 *
 * export default createMigration({
 *   async up({ db, schema }) {
 *     await schema.createTable(users)
 *
 *     if (db.adapter.dialect === 'sqlite') {
 *       await db.exec('pragma foreign_keys = on')
 *     }
 *   },
 *   async down({ schema }) {
 *     await schema.dropTable('users', { ifExists: true })
 *   },
 * })
 * ```
 */
export function createMigration(input) {
    return {
        up: input.up,
        down: input.down,
        transaction: input.transaction ?? 'auto',
    };
}
