import * as assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { column } from './column.ts';
import { createDatabase, Database } from './database.ts';
import type { QueryColumnTypesForTable, QueryForTable, QueryTableInput, WriteResult, } from './database.ts';
import type { Query } from './query.ts';
import { query } from './query.ts';
import type * as migrationPublicApi from '../migrations.ts';
import type * as publicApi from '../index.ts';
import type { Database as PublicDatabase, Predicate as PublicPredicate, SqlStatement as PublicSqlStatement, Table as PublicTable, TableRow as PublicTableRow, WhereInput as PublicWhereInput, } from '../index.ts';
import type { MigrateOptions as PublicMigrateOptions, MigrateResult as PublicMigrateResult, Migration as PublicMigration, MigrationContext as PublicMigrationContext, MigrationRunner as PublicMigrationRunner, MigrationSchema as PublicMigrationSchema, } from '../migrations.ts';
// @ts-expect-error CountQuery is no longer exported
import type { CountQuery as _CountQuery } from '../index.ts';
// @ts-expect-error InsertCommand is no longer exported
import type { InsertCommand as _InsertCommand } from '../index.ts';
// @ts-expect-error AnyQuery is no longer exported
import type { AnyQuery as _PublicAnyQuery } from '../index.ts';
// @ts-expect-error QueryMethod is no longer exported
import type { QueryMethod as _QueryMethod } from '../index.ts';
// @ts-expect-error QueryColumnTypesForTable is no longer exported
import type { QueryColumnTypesForTable as _PublicQueryColumnTypesForTable } from '../index.ts';
// @ts-expect-error QueryForTable is no longer exported
import type { QueryForTable as _PublicQueryForTable } from '../index.ts';
// @ts-expect-error QueryTableInput is no longer exported
import type { QueryTableInput as _PublicQueryTableInput } from '../index.ts';
// @ts-expect-error WriteResult is no longer exported
import type { WriteResult as _PublicWriteResult } from '../index.ts';
// @ts-expect-error ColumnBuilder is no longer exported
import type { ColumnBuilder as _PublicColumnBuilder } from '../index.ts';
// @ts-expect-error ColumnNamespace is no longer exported
import type { ColumnNamespace as _PublicColumnNamespace } from '../index.ts';
// @ts-expect-error TableReference is no longer exported
import type { TableReference as _PublicTableReference } from '../index.ts';
// @ts-expect-error AdapterCapabilities is no longer exported
import type { AdapterCapabilities as _PublicAdapterCapabilities } from '../index.ts';
// @ts-expect-error DataManipulationOperation is no longer exported
import type { DataManipulationOperation as _PublicDataManipulationOperation } from '../index.ts';
// @ts-expect-error CreateMigrationInput is no longer exported
import type { CreateMigrationInput as _CreateMigrationInput } from '../migrations.ts';
// @ts-expect-error MigrationDescriptor is no longer exported
import type { MigrationDescriptor as _MigrationDescriptor } from '../migrations.ts';
// @ts-expect-error MigrationStatus is no longer exported
import type { MigrationStatus as _MigrationStatus } from '../migrations.ts';
// @ts-expect-error MigrationTransactionMode is no longer exported
import type { MigrationTransactionMode as _MigrationTransactionMode } from '../migrations.ts';
// @ts-expect-error AlterTableBuilder is no longer exported
import type { AlterTableBuilder as _AlterTableBuilder } from '../migrations.ts';
import type { MigrateOptions, MigrateResult, Migration, MigrationContext, MigrationRunner, MigrationSchema, } from './migrations.ts';
import { table } from './table.ts';
import { hasMany } from './table-relations.ts';
import type { TableReference, TableRow } from './table.ts';
import { eq } from './operators.ts';
import type { Predicate, WhereInput } from './operators.ts';
import type { SqlStatement } from './sql.ts';
import type { SqliteTestSeed } from '../../test/sqlite-test-database.ts';
import { createSqliteTestAdapter } from '../../test/sqlite-test-database.ts';
// @ts-expect-error fail is no longer exported
type _Fail = (typeof publicApi)['fail'];
// @ts-expect-error timestamps is no longer exported
type _Timestamps = (typeof publicApi)['timestamps'];
// @ts-expect-error getTableName is no longer exported
type _GetTableName = (typeof publicApi)['getTableName'];
// @ts-expect-error getTablePrimaryKey is no longer exported
type _GetTablePrimaryKey = (typeof publicApi)['getTablePrimaryKey'];
// @ts-expect-error getTableColumnDefinitions is no longer exported
type _GetTableColumnDefinitions = (typeof publicApi)['getTableColumnDefinitions'];
// @ts-expect-error column is no longer exported
type _MigrationColumn = (typeof migrationPublicApi)['column'];
// @ts-expect-error parseMigrationFilename is no longer exported
type _ParseMigrationFilename = (typeof migrationPublicApi)['parseMigrationFilename'];
type Equal<left, right> = (<value>() => value extends left ? 1 : 2) extends <value>() => value extends right ? 1 : 2 ? true : false;
function expectType<condition extends true>(_value?: condition): void { }
let accounts = table({
    name: 'accounts',
    columns: {
        id: column.integer(),
        email: column.text(),
        status: column.text(),
    },
});
let projects = table({
    name: 'projects',
    columns: {
        id: column.integer(),
        account_id: column.integer(),
        archived: column.boolean(),
    },
});
const statuses: readonly [
    'draft',
    'published'
] = ['draft', 'published'];
let accountProjects = hasMany(accounts, projects);
let inferredColumns = table({
    name: 'inferred_columns',
    columns: {
        id: column.integer(),
        title: column.text(),
        is_active: column.boolean(),
        amount: column.decimal(10, 2),
        status: column.enum(statuses),
        metadata: column.json(),
        happened_at: column.timestamp(),
        big_counter: column.bigint(),
        validated_payload: column.json(),
    },
});
let cleanups = new Set<() => void>();
afterEach(() => {
    for (let cleanup of cleanups) {
        cleanup();
    }
    cleanups.clear();
});
describe('type safety', () => {
    it('keeps the supported public root and migrations type exports aligned with internals', () => {
        type AccountsIsPublicTable = typeof accounts extends PublicTable<any, any, any> ? true : false;
        type AccountColumns = 'email' | 'id' | 'status';
        expectType<Equal<PublicDatabase, Database>>();
        expectType<Equal<AccountsIsPublicTable, true>>();
        expectType<Equal<PublicTableRow<typeof accounts>, TableRow<typeof accounts>>>();
        expectType<Equal<PublicPredicate<AccountColumns>, Predicate<AccountColumns>>>();
        expectType<Equal<PublicWhereInput<AccountColumns>, WhereInput<AccountColumns>>>();
        expectType<Equal<PublicSqlStatement, SqlStatement>>();
        expectType<Equal<PublicMigration, Migration>>();
        expectType<Equal<PublicMigrationContext, MigrationContext>>();
        expectType<Equal<PublicMigrationSchema, MigrationSchema>>();
        expectType<Equal<PublicMigrationRunner, MigrationRunner>>();
        expectType<Equal<PublicMigrateOptions, MigrateOptions>>();
        expectType<Equal<PublicMigrateResult, MigrateResult>>();
    });
    it('infers unvalidated column types from physical types and falls back to unknown', () => {
        type Row = TableRow<typeof inferredColumns>;
        expectType<Equal<Row['title'], string>>();
        expectType<Equal<Row['is_active'], boolean>>();
        expectType<Equal<Row['amount'], number>>();
        expectType<Equal<Row['status'], 'draft' | 'published'>>();
        expectType<Equal<Row['metadata'], unknown>>();
        expectType<Equal<Row['happened_at'], unknown>>();
        expectType<Equal<Row['big_counter'], unknown>>();
        expectType<Equal<Row['validated_payload'], unknown>>();
    });
    it('types direct construction, helper construction, and transaction callbacks as Database', async () => {
        let direct = new Database(createAdapter());
        let wrapped = createDatabase(createAdapter());
        expectType<Equal<typeof direct, Database>>();
        expectType<Equal<typeof wrapped, Database>>();
        await direct.transaction(async (transactionDatabase) => {
            expectType<Equal<typeof transactionDatabase, Database>>();
            return undefined;
        });
        assert.equal(direct instanceof Database, true);
        assert.equal(wrapped instanceof Database, true);
    });
    it('exposes Query generics as column and row output maps', () => {
        let accountQuery = query(accounts);
        type QueryType = typeof accountQuery;
        type QuerySource = QueryType extends Query<infer source, any, any, any, any> ? source : never;
        type QueryColumns = QueryType extends Query<any, infer columnTypes, any, any, any> ? columnTypes : never;
        type QueryRow = QueryType extends Query<any, any, infer row, any, any> ? row : never;
        type QueryTableName = QuerySource extends QueryTableInput<infer name, any, any> ? name : never;
        type QueryPrimaryKey = QuerySource extends QueryTableInput<any, any, infer key> ? key : never;
        type QueryMode = QueryType extends Query<any, any, any, any, infer mode> ? mode : never;
        type QueryFromTableAlias = QueryForTable<typeof accounts>;
        type QueryColumnsFromAlias = QueryColumnTypesForTable<typeof accounts>;
        type AccountsReference = TableReference<typeof accounts>;
        type AccountsReferenceColumns = keyof AccountsReference['columns'] & string;
        type ExpectedColumns = {
            id: number;
            email: string;
            status: string;
            'accounts.id': number;
            'accounts.email': string;
            'accounts.status': string;
        };
        type ExpectedRow = {
            id: number;
            email: string;
            status: string;
        };
        expectType<Equal<QueryColumns, ExpectedColumns>>();
        expectType<Equal<QueryRow, ExpectedRow>>();
        expectType<Equal<QueryTableName, 'accounts'>>();
        expectType<Equal<QueryPrimaryKey, readonly [
            'id'
        ]>>();
        expectType<Equal<QueryType, QueryFromTableAlias>>();
        expectType<Equal<QueryMode, 'all'>>();
        expectType<Equal<QueryColumns, QueryColumnsFromAlias>>();
        expectType<Equal<AccountsReference['kind'], 'table'>>();
        expectType<Equal<AccountsReference['name'], 'accounts'>>();
        expectType<Equal<AccountsReference['primaryKey'], readonly [
            'id'
        ]>>();
        expectType<Equal<AccountsReferenceColumns, 'email' | 'id' | 'status'>>();
    });
    it('types query(table) and db.exec(...) for unbound queries in every execution mode', async () => {
        let db = createDatabase(createAdapter({
            accounts: [
                { id: 1, email: 'a@example.com', status: 'active' },
                { id: 2, email: 'b@example.com', status: 'inactive' },
            ],
            projects: [{ id: 100, account_id: 1, archived: false }],
        }));
        let unbound = query(accounts).where({ status: 'active' });
        let firstQuery = query(accounts).first();
        let updateQuery = query(accounts).where({ status: 'inactive' }).update({ status: 'active' });
        let rows = await db.exec(unbound);
        let first = await db.exec(firstQuery);
        let found = await db.exec(query(accounts).find(1));
        let count = await db.exec(query(accounts).count());
        let exists = await db.exec(query(accounts).where({ status: 'active' }).exists());
        let insertResult = await db.exec(query(accounts).insert({ id: 3, email: 'c@example.com', status: 'inactive' }));
        let insertManyResult = await db.exec(query(accounts).insertMany([
            { id: 4, email: 'd@example.com', status: 'archived' },
            { id: 5, email: 'e@example.com', status: 'active' },
        ]));
        let updateResult = await db.exec(updateQuery);
        let deleteResult = await db.exec(query(accounts).where({ id: 4 }).delete());
        let upsertResult = await db.exec(query(accounts).upsert({ id: 6, email: 'f@example.com', status: 'active' }, { conflictTarget: ['id'] }));
        assert.equal(rows.length, 1);
        assert.equal(first?.id, 1);
        assert.equal(found?.id, 1);
        assert.equal(count, 2);
        assert.equal(exists, true);
        assert.equal(insertResult.affectedRows, 1);
        assert.equal(insertManyResult.affectedRows, 2);
        assert.equal(updateResult.affectedRows, 2);
        assert.equal(deleteResult.affectedRows, 1);
        assert.equal(upsertResult.affectedRows, 1);
        type Unbound = typeof unbound;
        type FirstQuery = typeof firstQuery;
        type UpdateQuery = typeof updateQuery;
        type UnboundMode = Unbound extends Query<any, any, any, any, infer mode> ? mode : never;
        type FirstMode = FirstQuery extends Query<any, any, any, any, infer mode> ? mode : never;
        type UpdateMode = UpdateQuery extends Query<any, any, any, any, infer mode> ? mode : never;
        type Row = (typeof rows)[number];
        expectType<Equal<UnboundMode, 'all'>>();
        expectType<Equal<FirstMode, 'first'>>();
        expectType<Equal<UpdateMode, 'update'>>();
        expectType<Equal<Row['id'], number>>();
        expectType<Equal<Row['email'], string>>();
        function verifyTypeErrors(): void {
            // @ts-expect-error terminal queries do not expose builder methods
            query(accounts).first().where({ id: 1 });
            // @ts-expect-error terminal queries do not expose builder methods
            query(accounts).update({ status: 'active' }).limit(1);
            // @ts-expect-error values are only accepted for raw SQL exec()
            db.exec(query(accounts), []);
            // @ts-expect-error db.exec only accepts Query values or raw SQL
            db.exec({ kind: 'count' });
        }
        void verifyTypeErrors;
    });
    it('narrows select() result types while preserving relation types', async () => {
        let db = createDatabase(createAdapter({
            accounts: [{ id: 1, email: 'a@example.com', status: 'active' }],
            projects: [
                { id: 100, account_id: 1, archived: false },
                { id: 101, account_id: 3, archived: false },
            ],
        }));
        let rows = await db.exec(query(accounts).select('id').with({ projects: accountProjects }).all());
        assert.equal(rows.length, 1);
        assert.equal(rows[0].id, 1);
        assert.equal(rows[0].projects.length, 1);
        assert.equal(Boolean(rows[0].projects[0].archived), false);
        assert.deepEqual(Object.keys(rows[0]).sort(), ['id', 'projects']);
        type Row = (typeof rows)[number];
        expectType<Equal<Row['id'], number>>();
        expectType<Equal<Row['projects'][number]['id'], number>>();
        expectType<Equal<Row['projects'][number]['account_id'], number>>();
        expectType<Equal<Row['projects'][number]['archived'], boolean>>();
        // @ts-expect-error select('id') should not expose non-selected account columns
        rows[0].email;
    });
    it('supports typed alias select() and joined order/group columns', async () => {
        let db = createDatabase(createAdapter({
            accounts: [{ id: 1, email: 'a@example.com', status: 'active' }],
            projects: [
                { id: 100, account_id: 1, archived: false },
                { id: 101, account_id: 3, archived: false },
            ],
        }));
        let rows = await db.exec(query(accounts).join(projects, eq(accounts.id, projects.account_id))
            .select({
            accountId: accounts.id,
            accountEmail: accounts.email,
            projectId: projects.id,
            projectArchived: projects.archived,
        })
            .orderBy(projects.id, 'asc')
            .all());
        assert.equal(rows.length, 1);
        assert.equal(rows[0].accountId, 1);
        assert.equal(rows[0].accountEmail, 'a@example.com');
        assert.equal(rows[0].projectId, 100);
        assert.equal(Boolean(rows[0].projectArchived), false);
        let groupedCount = await db.exec(query(accounts).join(projects, eq(accounts.id, projects.account_id))
            .groupBy(projects.account_id)
            .having(eq(projects.account_id, 1))
            .count());
        assert.equal(groupedCount, 1);
        type Row = (typeof rows)[number];
        expectType<Equal<Row['accountId'], number>>();
        expectType<Equal<Row['accountEmail'], string>>();
        expectType<Equal<Row['projectId'], number>>();
        expectType<Equal<Row['projectArchived'], boolean>>();
        // @ts-expect-error alias select should not expose original source column names
        rows[0].email;
        function verifyTypeErrors(): void {
            query(accounts)
                .join(projects, eq(accounts.id, projects.account_id))
                // @ts-expect-error unknown joined column for orderBy
                .orderBy(projects.nope);
            query(accounts)
                .join(projects, eq(accounts.id, projects.account_id))
                // @ts-expect-error unknown joined column for groupBy
                .groupBy(projects.nope);
            query(accounts)
                .join(projects, eq(accounts.id, projects.account_id))
                // @ts-expect-error unknown source column in alias selection
                .select({ bad: projects.nope });
        }
        void verifyTypeErrors;
    });
    it('enforces typed keys for where/having/join/relation filters while running real queries', async () => {
        let db = createDatabase(createAdapter({
            accounts: [{ id: 1, email: 'a@example.com', status: 'active' }],
            projects: [{ id: 100, account_id: 1, archived: false }],
        }));
        let filtered = await db.exec(query(accounts).where({ status: 'active' }).all());
        let groupedCount = await db.exec(query(accounts).groupBy('status')
            .having({ status: 'active' })
            .count());
        let joined = await db.exec(query(accounts).join(projects, eq(accounts.id, projects.account_id))
            .where(eq(projects.archived, false))
            .all());
        let withRelations = await db.exec(query(accounts).with({ projects: accountProjects.where({ archived: false }) })
            .all());
        assert.equal(filtered.length, 1);
        assert.equal(groupedCount, 1);
        assert.equal(joined.length, 1);
        assert.equal(withRelations[0].projects.length, 1);
        function verifyTypeErrors(): void {
            // @ts-expect-error unknown predicate key
            query(accounts).where({ not_a_column: 'active' });
            // @ts-expect-error unknown predicate key
            query(accounts).having({ not_a_column: 'active' });
            // @ts-expect-error join predicate key must be from source or target table
            query(accounts).join(projects, eq('not_a_column', true));
            // @ts-expect-error right-hand column reference must be from source or target table
            query(accounts).join(projects, eq(accounts.id, 'projects.not_a_column'));
            // @ts-expect-error relation predicate key must be from relation target table
            accountProjects.where({ not_a_column: true });
        }
        void verifyTypeErrors;
    });
    it('keeps read query typing symmetric for single-table queries', async () => {
        let db = createDatabase(createAdapter({
            accounts: [{ id: 1, email: 'a@example.com', status: 'active' }],
            projects: [{ id: 100, account_id: 1, archived: false }],
        }));
        let first = await db.exec(query(accounts).find(1));
        let active = await db.exec(query(accounts).where({ status: 'active' }).orderBy('accounts.id', 'asc').first());
        let rows = await db.exec(query(accounts).where(eq('status', 'active'))
            .orderBy('status', 'asc')
            .orderBy('id', 'desc')
            .with({ projects: accountProjects })
            .all());
        let count = await db.exec(query(accounts).where({ status: 'active' }).count());
        assert.equal(first?.id, 1);
        assert.equal(active?.email, 'a@example.com');
        assert.equal(rows.length, 1);
        assert.equal(rows[0].projects.length, 1);
        assert.equal(count, 1);
        type Row = (typeof rows)[number];
        expectType<Equal<Row['projects'][number]['id'], number>>();
        expectType<Equal<Row['projects'][number]['account_id'], number>>();
        expectType<Equal<Row['projects'][number]['archived'], boolean>>();
        function verifyTypeErrors(): void {
            // @ts-expect-error unknown where key
            query(accounts).where({ not_a_column: 'active' });
            // @ts-expect-error unknown orderBy column
            query(accounts).orderBy('not_a_column', 'asc');
            // @ts-expect-error terminal queries do not expose builder methods
            query(accounts).count().orderBy('id', 'asc');
        }
        void verifyTypeErrors;
    });
    it('keeps update/delete query typing symmetric for single-table queries', async () => {
        let db = createDatabase(createAdapter({
            accounts: [
                { id: 1, email: 'a@example.com', status: 'active' },
                { id: 2, email: 'b@example.com', status: 'inactive' },
            ],
            projects: [{ id: 100, account_id: 1, archived: false }],
        }));
        await db.exec(query(accounts).where({ id: 1 }).update({ status: 'inactive' }));
        let updated = await db.exec(query(accounts).with({ projects: accountProjects }).find(1));
        let updateManyResult = await db.exec(query(accounts).where({ status: 'inactive' }).orderBy('id', 'asc').limit(1).update({ status: 'active' }));
        let deleted = await db.exec(query(accounts).where({ id: 2 }).delete());
        let deleteManyResult = await db.exec(query(accounts).where(eq('status', 'active')).orderBy('id', 'desc').limit(1).delete());
        assert.equal(updated?.id, 1);
        assert.equal(updated?.projects.length, 1);
        assert.equal(updateManyResult.affectedRows, 1);
        assert.equal(deleted.affectedRows, 1);
        assert.equal(deleteManyResult.affectedRows, 1);
        function verifyTypeErrors(): void {
            // @ts-expect-error unknown update key
            query(accounts).where({ id: 1 }).update({ not_a_column: 'x' });
            // @ts-expect-error unknown where key
            query(accounts).where({ not_a_column: 'x' }).update({ status: 'active' });
            // @ts-expect-error unknown where key
            query(accounts).where({ not_a_column: 'x' }).delete();
            // @ts-expect-error unknown orderBy key
            query(accounts).where({ status: 'active' }).orderBy('nope', 'asc').delete();
        }
        void verifyTypeErrors;
    });
    it('supports typed insert/insertMany query modes', async () => {
        let db = createDatabase(createAdapter({
            accounts: [{ id: 1, email: 'a@example.com', status: 'active' }],
            projects: [
                { id: 100, account_id: 1, archived: false },
                { id: 101, account_id: 3, archived: false },
            ],
        }));
        let createResult = await db.exec(query(accounts).insert({
            id: 2,
            email: 'b@example.com',
            status: 'active',
        }));
        let createdResult = await db.exec(query(accounts).insert({
            id: 3,
            email: 'c@example.com',
            status: 'inactive',
        }, { returning: '*' }));
        let created = await db.exec(query(accounts).with({ projects: accountProjects }).find(3));
        let createManyResult = await db.exec(query(accounts).insertMany([
            { id: 4, email: 'd@example.com', status: 'active' },
            { id: 5, email: 'e@example.com', status: 'inactive' },
        ]));
        let createdRowsResult = await db.exec(query(accounts).insertMany([{ id: 6, email: 'f@example.com', status: 'active' }], { returning: '*' }));
        let createdRows = 'rows' in createdRowsResult ? createdRowsResult.rows : [];
        expectType<Equal<NonNullable<typeof created>['id'], number>>();
        expectType<Equal<NonNullable<typeof created>['projects'][number]['id'], number>>();
        expectType<Equal<(typeof createdRows)[number]['id'], number>>();
        expectType<Equal<(typeof createdRows)[number]['email'], string>>();
        assert.equal(createResult.affectedRows, 1);
        assert.equal('row' in createdResult && createdResult.row ? createdResult.row.id : null, 3);
        assert.equal(created?.id, 3);
        assert.equal(created?.projects.length, 1);
        assert.equal(createManyResult.affectedRows, 2);
        assert.equal(createdRows.length, 1);
        function verifyTypeErrors(): void {
            // @ts-expect-error unknown insert key
            query(accounts).insert({ not_a_column: 'x' });
            // @ts-expect-error unknown createMany insert key
            query(accounts).insertMany([{ not_a_column: 'x' }]);
            query(accounts).insert({ id: 7, email: 'g@example.com', status: 'active' }, 
            // @ts-expect-error invalid insert option key
            { returnRow: true });
        }
        void verifyTypeErrors;
    });
});
function createAdapter(seed: SqliteTestSeed = {}) {
    let { adapter, close } = createSqliteTestAdapter(seed);
    cleanups.add(close);
    return adapter;
}
