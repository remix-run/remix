import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { rawSql, sql } from './sql.ts'
import type {
  DataManipulationRequest,
  DataMigrationRequest,
  DataMigrationResult,
  DataMigrationOperation,
  DataManipulationResult,
  DatabaseAdapter,
  TableRef,
  TransactionToken,
} from './adapter.ts'
import { column } from './column.ts'
import { parseMigrationFilename } from './migrations/filename.ts'
import { createMigrationRegistry } from './migrations/registry.ts'
import { createMigrationRunner } from './migrations/runner.ts'
import { createMigration } from './migrations.ts'
import type { SqlStatement } from './sql.ts'
import { table } from './table.ts'

type JournalRow = {
  id: string
  name: string
  checksum: string
  batch: number
  applied_at: string
}

class MemoryMigrationAdapter implements DatabaseAdapter {
  dialect = 'memory'
  capabilities = {
    returning: true,
    savepoints: true,
    upsert: true,
    transactionalDdl: true,
    migrationLock: true,
  }
  journalTableCreated = false
  journalTableName = 'data_table_migrations'
  journalRows: JournalRow[] = []
  migratedOperations: DataMigrationOperation[] = []
  executedRawSql: SqlStatement[] = []
  executeTransactionIds: Array<string | undefined> = []
  migrateTransactionIds: Array<string | undefined> = []
  hasTableTransactionIds: Array<string | undefined> = []
  hasColumnTransactionIds: Array<string | undefined> = []
  knownTables = new Map<string, Set<string>>()
  lockAcquireCount = 0
  lockReleaseCount = 0
  beginTransactionCount = 0
  commitTransactionCount = 0
  rollbackTransactionCount = 0
  failOnMigrateKind: DataMigrationOperation['kind'] | undefined
  #transactionCounter = 0
  #tokens = new Set<string>()

  compileSql(
    operation: DataMigrationOperation | DataManipulationRequest['operation'],
  ): SqlStatement[] {
    return [{ text: operation.kind, values: [] }]
  }

  async execute(request: DataManipulationRequest): Promise<DataManipulationResult> {
    this.executeTransactionIds.push(request.transaction?.id)

    if (request.transaction) {
      this.#assertToken(request.transaction)
    }

    if (request.operation.kind !== 'raw') {
      throw new Error('MemoryMigrationAdapter only supports raw execute operations')
    }

    let statement = request.operation.sql
    let text = statement.text.toLowerCase()

    if (text.startsWith('select 1 from ')) {
      if (!this.journalTableCreated) {
        throw new Error('Journal table does not exist')
      }

      return { rows: [] }
    }

    if (text.includes('select id, name, checksum, batch, applied_at from ')) {
      if (!this.journalTableCreated) {
        throw new Error('Journal table does not exist')
      }

      return {
        rows: this.journalRows.map((row) => ({
          id: row.id,
          name: row.name,
          checksum: row.checksum,
          batch: row.batch,
          applied_at: row.applied_at,
        })),
      }
    }

    if (text.startsWith('insert into ')) {
      let [id, name, checksum, batch, appliedAt] = statement.values

      this.journalRows.push({
        id: String(id),
        name: String(name),
        checksum: String(checksum),
        batch: Number(batch),
        applied_at:
          typeof appliedAt === 'string' && appliedAt.length > 0
            ? appliedAt
            : new Date().toISOString(),
      })

      return { affectedRows: 1 }
    }

    if (text.startsWith('delete from ')) {
      let [id] = statement.values
      this.journalRows = this.journalRows.filter((row) => row.id !== String(id))

      return { affectedRows: 1 }
    }

    this.executedRawSql.push(statement)
    return { affectedRows: 0 }
  }

  async migrate(request: DataMigrationRequest): Promise<DataMigrationResult> {
    this.migrateTransactionIds.push(request.transaction?.id)

    if (request.transaction) {
      this.#assertToken(request.transaction)
    }

    let operation = request.operation

    if (
      operation.kind === 'createTable' &&
      operation.table.name === this.journalTableName &&
      operation.table.schema === undefined
    ) {
      this.journalTableCreated = true
      this.knownTables.set(
        tableRefKey(operation.table),
        new Set<string>(Object.keys(operation.columns)),
      )
      return { affectedOperations: 1 }
    }

    if (this.failOnMigrateKind && operation.kind === this.failOnMigrateKind) {
      throw new Error('Forced migrate failure for kind ' + operation.kind)
    }

    if (operation.kind === 'createTable') {
      this.knownTables.set(
        tableRefKey(operation.table),
        new Set<string>(Object.keys(operation.columns)),
      )
    }

    if (operation.kind === 'dropTable') {
      this.knownTables.delete(tableRefKey(operation.table))
    }

    if (operation.kind === 'renameTable') {
      let fromKey = tableRefKey(operation.from)
      let toKey = tableRefKey(operation.to)
      let columns = this.knownTables.get(fromKey)

      if (columns) {
        this.knownTables.delete(fromKey)
        this.knownTables.set(toKey, columns)
      }
    }

    if (operation.kind === 'alterTable') {
      let key = tableRefKey(operation.table)
      let columns = this.knownTables.get(key) ?? new Set<string>()

      for (let change of operation.changes) {
        if (change.kind === 'addColumn') {
          columns.add(change.column)
        } else if (change.kind === 'dropColumn') {
          columns.delete(change.column)
        } else if (change.kind === 'renameColumn') {
          columns.delete(change.from)
          columns.add(change.to)
        }
      }

      this.knownTables.set(key, columns)
    }

    this.migratedOperations.push(operation)
    return { affectedOperations: 1 }
  }

  async hasTable(table: TableRef, transaction?: TransactionToken): Promise<boolean> {
    this.hasTableTransactionIds.push(transaction?.id)

    if (transaction) {
      this.#assertToken(transaction)
    }

    return this.knownTables.has(tableRefKey(table))
  }

  async hasColumn(
    table: TableRef,
    column: string,
    transaction?: TransactionToken,
  ): Promise<boolean> {
    this.hasColumnTransactionIds.push(transaction?.id)

    if (transaction) {
      this.#assertToken(transaction)
    }

    let columns = this.knownTables.get(tableRefKey(table))
    return columns?.has(column) === true
  }

  async beginTransaction(): Promise<TransactionToken> {
    this.beginTransactionCount += 1
    this.#transactionCounter += 1
    let token = { id: 'tx_' + String(this.#transactionCounter) }
    this.#tokens.add(token.id)
    return token
  }

  async commitTransaction(token: TransactionToken): Promise<void> {
    this.#assertToken(token)
    this.commitTransactionCount += 1
    this.#tokens.delete(token.id)
  }

  async rollbackTransaction(token: TransactionToken): Promise<void> {
    this.#assertToken(token)
    this.rollbackTransactionCount += 1
    this.#tokens.delete(token.id)
  }

  async createSavepoint(token: TransactionToken): Promise<void> {
    this.#assertToken(token)
  }

  async rollbackToSavepoint(token: TransactionToken): Promise<void> {
    this.#assertToken(token)
  }

  async releaseSavepoint(token: TransactionToken): Promise<void> {
    this.#assertToken(token)
  }

  async acquireMigrationLock(): Promise<void> {
    this.lockAcquireCount += 1
  }

  async releaseMigrationLock(): Promise<void> {
    this.lockReleaseCount += 1
  }

  #assertToken(token: TransactionToken): void {
    if (!this.#tokens.has(token.id)) {
      throw new Error('Unknown transaction token: ' + token.id)
    }
  }
}

function tableRefKey(table: TableRef): string {
  if (table.schema) {
    return table.schema + '.' + table.name
  }

  return table.name
}

function createIdTable(name: string) {
  return table({
    name,
    columns: {
      id: column.integer().primaryKey(),
    },
  })
}

describe('migration column builder', () => {
  it('builds canonical column specs with chainable methods', () => {
    let columnSpec = column
      .varchar(255)
      .notNull()
      .default('hello')
      .unique('users_email_unique')
      .references('auth.users', ['id'], 'users_auth_fk')
      .onDelete('cascade')
      .onUpdate('restrict')
      .check('length(email) > 3', 'users_email_len')
      .comment('Primary email')
      .computed('lower(email)', { stored: false })
      .collate('en_US')
      .charset('utf8mb4')
      .build()

    assert.deepEqual(columnSpec, {
      type: 'varchar',
      length: 255,
      nullable: false,
      default: { kind: 'literal', value: 'hello' },
      unique: { name: 'users_email_unique' },
      references: {
        table: { schema: 'auth', name: 'users' },
        columns: ['id'],
        name: 'users_auth_fk',
        onDelete: 'cascade',
        onUpdate: 'restrict',
      },
      checks: [{ expression: 'length(email) > 3', name: 'users_email_len' }],
      comment: 'Primary email',
      computed: { expression: 'lower(email)', stored: false },
      collate: 'en_US',
      charset: 'utf8mb4',
    })
  })

  it('throws when onDelete is called before references', () => {
    assert.throws(
      () => column.integer().onDelete('cascade'),
      /requires references\(\) to be set first/,
    )
  })

  it('throws when onUpdate is called before references', () => {
    assert.throws(
      () => column.integer().onUpdate('cascade'),
      /requires references\(\) to be set first/,
    )
  })

  it('supports every column constructor and modifier', () => {
    let textSpec = column.text().nullable().defaultNow().build()
    assert.equal(textSpec.type, 'text')
    assert.equal(textSpec.nullable, true)
    assert.deepEqual(textSpec.default, { kind: 'now' })

    let integerSpec = column
      .integer()
      .defaultSql('42')
      .unsigned()
      .autoIncrement()
      .identity({ always: true, start: 10, increment: 2 })
      .build()
    assert.equal(integerSpec.type, 'integer')
    assert.deepEqual(integerSpec.default, { kind: 'sql', expression: '42' })
    assert.equal(integerSpec.unsigned, true)
    assert.equal(integerSpec.autoIncrement, true)
    assert.deepEqual(integerSpec.identity, { always: true, start: 10, increment: 2 })

    let bigintSpec = column.bigint().build()
    assert.equal(bigintSpec.type, 'bigint')

    let decimalSpec = column.decimal(8, 2).precision(12).scale(4).build()
    assert.equal(decimalSpec.type, 'decimal')
    assert.equal(decimalSpec.precision, 12)
    assert.equal(decimalSpec.scale, 4)

    let decimalWithPrecisionScale = column.decimal(4, 1).precision(10, 3).build()
    assert.equal(decimalWithPrecisionScale.type, 'decimal')
    assert.equal(decimalWithPrecisionScale.precision, 10)
    assert.equal(decimalWithPrecisionScale.scale, 3)

    let booleanSpec = column.boolean().build()
    assert.equal(booleanSpec.type, 'boolean')

    let uuidSpec = column.uuid().build()
    assert.equal(uuidSpec.type, 'uuid')

    let dateSpec = column.date().build()
    assert.equal(dateSpec.type, 'date')

    let timeSpec = column.time({ precision: 6, withTimezone: true }).timezone(false).build()
    assert.equal(timeSpec.type, 'time')
    assert.equal(timeSpec.precision, 6)
    assert.equal(timeSpec.withTimezone, false)

    let timestampSpec = column.timestamp({ precision: 3, withTimezone: true }).build()
    assert.equal(timestampSpec.type, 'timestamp')
    assert.equal(timestampSpec.precision, 3)
    assert.equal(timestampSpec.withTimezone, true)

    let jsonSpec = column.json().build()
    assert.equal(jsonSpec.type, 'json')

    let binarySpec = column.binary(64).length(128).build()
    assert.equal(binarySpec.type, 'binary')
    assert.equal(binarySpec.length, 128)

    let enumSpec = column.enum(['one', 'two']).build()
    assert.equal(enumSpec.type, 'enum')
    assert.deepEqual(enumSpec.enumValues, ['one', 'two'])
  })

  it('retains existing reference metadata when references() is called again', () => {
    let spec = column
      .integer()
      .references('auth.accounts', 'id', 'accounts_fk')
      .onDelete('cascade')
      .onUpdate('restrict')
      .references('auth.users', 'accounts_fk')
      .build()

    assert.deepEqual(spec.references, {
      table: { schema: 'auth', name: 'users' },
      columns: ['id'],
      name: 'accounts_fk',
      onDelete: 'cascade',
      onUpdate: 'restrict',
    })
  })
})

describe('migration runner', () => {
  it('builds deterministic schema plans from migration APIs', async () => {
    let adapter = new MemoryMigrationAdapter()
    let migration = createMigration({
      async up({ db, schema }) {
        let usersTable = table({
          name: 'app.users',
          columns: {
            id: column.integer().primaryKey(),
            email: column.text().notNull(),
          },
        })
        await schema.createTable(usersTable)
        await schema.createIndex(usersTable, 'email', { name: 'users_email_idx', unique: true })

        await schema.alterTable(usersTable, (table) => {
          table.addColumn('status', column.text().default('active'))
          table.addCheck("status in ('active', 'disabled')", { name: 'users_status_check' })
          table.addIndex('status', { name: 'users_status_idx' })
        })

        await schema.renameIndex(usersTable, 'users_status_idx', 'users_status_idx_v2')
        await schema.plan('vacuum')
        await schema.plan(sql`select ${123}`)
      },
      async down() {},
    })

    let runner = createMigrationRunner(adapter, [
      { id: '20260101000000', name: 'users', migration },
    ])

    await runner.up()

    assert.deepEqual(
      adapter.migratedOperations.map((operation) => operation.kind),
      ['createTable', 'createIndex', 'alterTable', 'createIndex', 'renameIndex', 'raw', 'raw'],
    )

    let createTableOperation = adapter.migratedOperations[0]
    assert.equal(createTableOperation.kind, 'createTable')
    assert.deepEqual(createTableOperation.table, { schema: 'app', name: 'users' })
    assert.deepEqual(createTableOperation.primaryKey, {
      name: 'app_users_pk',
      columns: ['id'],
    })

    let createIndexOperation = adapter.migratedOperations[1]
    assert.equal(createIndexOperation.kind, 'createIndex')
    assert.deepEqual(createIndexOperation.index.columns, ['email'])

    let alterIndexOperation = adapter.migratedOperations[3]
    assert.equal(alterIndexOperation.kind, 'createIndex')
    assert.deepEqual(alterIndexOperation.index.columns, ['status'])

    let rawStringOperation = adapter.migratedOperations[5]
    assert.equal(rawStringOperation.kind, 'raw')
    assert.deepEqual(rawStringOperation.sql, rawSql('vacuum'))

    let rawStatementOperation = adapter.migratedOperations[6]
    assert.equal(rawStatementOperation.kind, 'raw')
    assert.deepEqual(rawStatementOperation.sql, sql`select ${123}`)
  })

  it('auto-generates deterministic names when omitted', async () => {
    let adapter = new MemoryMigrationAdapter()
    let migration = createMigration({
      async up({ db, schema }) {
        let accountsTable = table({
          name: 'app.accounts',
          columns: {
            id: column.integer().primaryKey(),
          },
        })
        let usersTable = table({
          name: 'app.users',
          columns: {
            id: column.integer().primaryKey(),
            account_id: column.integer().notNull(),
            email: column.text().notNull().unique(),
          },
        })

        await schema.createTable(accountsTable)
        await schema.createTable(usersTable)
        await schema.createIndex(usersTable, 'email')

        await schema.alterTable(usersTable, (table) => {
          table.addPrimaryKey('id')
          table.addUnique('email')
          table.addForeignKey('account_id', accountsTable, 'id')
          table.addCheck('id > 0')
          table.addIndex('email')
        })

        await schema.addForeignKey(usersTable, 'account_id', accountsTable, 'id')
        await schema.addCheck(usersTable, 'id > 0')
      },
      async down() {},
    })

    let runner = createMigrationRunner(adapter, [
      { id: '20260101000000', name: 'names', migration },
    ])
    await runner.up()

    let createUsers = adapter.migratedOperations[1]
    assert.equal(createUsers?.kind, 'createTable')
    if (createUsers.kind !== 'createTable') {
      throw new Error('Expected createTable operation at index 1')
    }
    assert.equal(createUsers.primaryKey?.name, 'app_users_pk')
    assert.equal(createUsers.uniques?.[0]?.name, 'app_users_email_uq')

    let createIndex = adapter.migratedOperations[2]
    assert.equal(createIndex?.kind, 'createIndex')
    if (createIndex.kind !== 'createIndex') {
      throw new Error('Expected createIndex operation at index 2')
    }
    assert.equal(createIndex.index.name, 'app_users_email_idx')

    let alterTable = adapter.migratedOperations[3]
    assert.equal(alterTable?.kind, 'alterTable')
    if (alterTable.kind !== 'alterTable') {
      throw new Error('Expected alterTable operation at index 3')
    }

    let alterAddPrimaryKey = alterTable.changes.find((change) => change.kind === 'addPrimaryKey')
    if (!alterAddPrimaryKey || alterAddPrimaryKey.kind !== 'addPrimaryKey') {
      throw new Error('Expected addPrimaryKey change')
    }
    assert.equal(alterAddPrimaryKey.constraint.name, 'app_users_pk')

    let alterAddUnique = alterTable.changes.find((change) => change.kind === 'addUnique')
    if (!alterAddUnique || alterAddUnique.kind !== 'addUnique') {
      throw new Error('Expected addUnique change')
    }
    assert.equal(alterAddUnique.constraint.name, 'app_users_email_uq')

    let alterAddForeignKey = alterTable.changes.find((change) => change.kind === 'addForeignKey')
    if (!alterAddForeignKey || alterAddForeignKey.kind !== 'addForeignKey') {
      throw new Error('Expected addForeignKey change')
    }
    assert.equal(alterAddForeignKey.constraint.name, 'app_users_account_id_app_accounts_id_fk')

    let alterAddCheck = alterTable.changes.find((change) => change.kind === 'addCheck')
    if (!alterAddCheck || alterAddCheck.kind !== 'addCheck') {
      throw new Error('Expected addCheck change')
    }
    assert.ok(alterAddCheck.constraint.name.startsWith('app_users_chk_'))

    let topLevelAddForeignKey = adapter.migratedOperations[5]
    assert.equal(topLevelAddForeignKey?.kind, 'addForeignKey')
    if (topLevelAddForeignKey.kind !== 'addForeignKey') {
      throw new Error('Expected addForeignKey operation at index 5')
    }
    assert.equal(topLevelAddForeignKey.constraint.name, 'app_users_account_id_app_accounts_id_fk')

    let topLevelAddCheck = adapter.migratedOperations[6]
    assert.equal(topLevelAddCheck?.kind, 'addCheck')
    if (topLevelAddCheck.kind !== 'addCheck') {
      throw new Error('Expected addCheck operation at index 6')
    }
    assert.equal(topLevelAddCheck.constraint.name, alterAddCheck.constraint.name)
  })

  it('prefers explicit names over generated defaults', async () => {
    let adapter = new MemoryMigrationAdapter()
    let migration = createMigration({
      async up({ db, schema }) {
        let usersTable = table({
          name: 'users',
          columns: {
            id: column.integer().primaryKey(),
            email: column.text().notNull(),
          },
        })

        await schema.createTable(usersTable)
        await schema.createIndex(usersTable, 'email', { name: 'users_email_idx' })
        await schema.alterTable(usersTable, (table) => {
          table.addPrimaryKey('id', { name: 'users_pk_named' })
          table.addUnique('email', { name: 'users_email_uq_named' })
          table.addCheck('id > 0', { name: 'users_id_check_named' })
          table.addIndex('email', { name: 'users_email_alter_idx_named' })
        })
      },
      async down() {},
    })

    let runner = createMigrationRunner(adapter, [
      { id: '20260101000000', name: 'named', migration },
    ])
    await runner.up()

    let createIndex = adapter.migratedOperations[1]
    assert.equal(createIndex?.kind, 'createIndex')
    if (createIndex.kind !== 'createIndex') {
      throw new Error('Expected createIndex operation at index 1')
    }
    assert.equal(createIndex.index.name, 'users_email_idx')

    let alterTable = adapter.migratedOperations[2]
    assert.equal(alterTable?.kind, 'alterTable')
    if (alterTable.kind !== 'alterTable') {
      throw new Error('Expected alterTable operation at index 2')
    }

    let addPrimaryKey = alterTable.changes.find((change) => change.kind === 'addPrimaryKey')
    if (!addPrimaryKey || addPrimaryKey.kind !== 'addPrimaryKey') {
      throw new Error('Expected addPrimaryKey change')
    }
    assert.equal(addPrimaryKey.constraint.name, 'users_pk_named')

    let addUnique = alterTable.changes.find((change) => change.kind === 'addUnique')
    if (!addUnique || addUnique.kind !== 'addUnique') {
      throw new Error('Expected addUnique change')
    }
    assert.equal(addUnique.constraint.name, 'users_email_uq_named')

    let addCheck = alterTable.changes.find((change) => change.kind === 'addCheck')
    if (!addCheck || addCheck.kind !== 'addCheck') {
      throw new Error('Expected addCheck change')
    }
    assert.equal(addCheck.constraint.name, 'users_id_check_named')

    let alterIndex = adapter.migratedOperations[3]
    assert.equal(alterIndex?.kind, 'createIndex')
    if (alterIndex.kind !== 'createIndex') {
      throw new Error('Expected createIndex operation at index 3')
    }
    assert.equal(alterIndex.index.name, 'users_email_alter_idx_named')
  })

  it('applies, reverts by step, and reverts by target', async () => {
    let adapter = new MemoryMigrationAdapter()
    let migrations = [
      {
        id: '20260101000000',
        name: 'users',
        migration: createMigration({
          async up({ db, schema }) {
            await schema.createTable(createIdTable('users'))
          },
          async down({ db, schema }) {
            await schema.dropTable('users')
          },
        }),
      },
      {
        id: '20260102000000',
        name: 'posts',
        migration: createMigration({
          async up({ db, schema }) {
            await schema.createTable(createIdTable('posts'))
          },
          async down({ db, schema }) {
            await schema.dropTable('posts')
          },
        }),
      },
    ]

    let runner = createMigrationRunner(adapter, migrations)

    await runner.up()
    let statusAfterUp = await runner.status()
    assert.deepEqual(
      statusAfterUp.map((entry) => entry.status),
      ['applied', 'applied'],
    )

    await runner.down({ step: 1 })
    let statusAfterStepDown = await runner.status()
    assert.deepEqual(
      statusAfterStepDown.map((entry) => entry.status),
      ['applied', 'pending'],
    )

    await runner.down({ to: '20260101000000' })
    let statusAfterTargetDown = await runner.status()
    assert.deepEqual(
      statusAfterTargetDown.map((entry) => entry.status),
      ['pending', 'pending'],
    )
  })

  it('supports dryRun planning without executing migration DDL', async () => {
    let adapter = new MemoryMigrationAdapter()
    let migration = createMigration({
      async up({ db, schema }) {
        await schema.createTable(createIdTable('users'))
      },
      async down() {},
    })

    let runner = createMigrationRunner(adapter, [
      { id: '20260101000000', name: 'users', migration },
    ])

    let result = await runner.up({ dryRun: true })

    assert.deepEqual(result.sql, [{ text: 'createTable', values: [] }])
    assert.equal(adapter.migratedOperations.length, 0)
    assert.equal(adapter.journalRows.length, 0)
  })

  it('detects checksum drift before applying more migrations', async () => {
    let adapter = new MemoryMigrationAdapter()
    let appliedMigration = createMigration({
      async up({ db, schema }) {
        await schema.createTable(createIdTable('users'))
      },
      async down() {},
    })

    let runner = createMigrationRunner(adapter, [
      {
        id: '20260101000000',
        name: 'users',
        checksum: 'checksum_a',
        migration: appliedMigration,
      },
    ])

    await runner.up()

    let driftedRunner = createMigrationRunner(adapter, [
      {
        id: '20260101000000',
        name: 'users',
        checksum: 'checksum_b',
        migration: appliedMigration,
      },
    ])

    await assert.rejects(() => driftedRunner.up(), /checksum drift detected/)
  })

  it('balances migration lock hooks when migration execution fails', async () => {
    let adapter = new MemoryMigrationAdapter()
    adapter.failOnMigrateKind = 'createTable'

    let migration = createMigration({
      async up({ db, schema }) {
        await schema.createTable(createIdTable('users'))
      },
      async down() {},
    })

    let runner = createMigrationRunner(adapter, [
      { id: '20260101000000', name: 'users', migration },
    ])

    await assert.rejects(() => runner.up(), /Forced migrate failure/)
    assert.equal(adapter.lockAcquireCount, 1)
    assert.equal(adapter.lockReleaseCount, 1)
  })

  it('throws when required transactions are requested on non-transactional adapters', async () => {
    let adapter = new MemoryMigrationAdapter()
    adapter.capabilities.transactionalDdl = false

    let migration = createMigration({
      transaction: 'required',
      async up({ db, schema }) {
        await schema.createTable(createIdTable('users'))
      },
      async down() {},
    })

    let runner = createMigrationRunner(adapter, [
      { id: '20260101000000', name: 'users', migration },
    ])

    await assert.rejects(() => runner.up(), /requires transactional DDL/)
  })

  it('throws for unknown migration targets and invalid step values', async () => {
    let adapter = new MemoryMigrationAdapter()
    let migration = createMigration({
      async up({ db, schema }) {
        await schema.createTable(createIdTable('users'))
      },
      async down() {},
    })

    let runner = createMigrationRunner(adapter, [
      { id: '20260101000000', name: 'users', migration },
    ])

    await assert.rejects(() => runner.up({ to: '99999999999999' }), /Unknown migration target/)
    await assert.rejects(() => runner.up({ step: 0 }), /positive integer/)
    await assert.rejects(
      () => runner.up({ to: '20260101000000', step: 1 } as never),
      /Cannot combine "to" and "step"/,
    )
  })

  it('supports up() target and step boundaries', async () => {
    let adapter = new MemoryMigrationAdapter()
    let migrations = [
      {
        id: '20260101000000',
        name: 'users',
        migration: createMigration({
          async up({ db, schema }) {
            await schema.createTable(createIdTable('users'))
          },
          async down() {},
        }),
      },
      {
        id: '20260102000000',
        name: 'posts',
        migration: createMigration({
          async up({ db, schema }) {
            await schema.createTable(createIdTable('posts'))
          },
          async down() {},
        }),
      },
    ]

    let targetRunner = createMigrationRunner(adapter, migrations)
    await targetRunner.up({ to: '20260101000000' })
    assert.deepEqual(
      adapter.journalRows.map((row) => row.id),
      ['20260101000000'],
    )

    adapter.journalRows = []
    adapter.journalTableCreated = false
    adapter.migratedOperations = []

    let stepRunner = createMigrationRunner(adapter, migrations)
    await stepRunner.up({ step: 1 })
    assert.deepEqual(
      adapter.journalRows.map((row) => row.id),
      ['20260101000000'],
    )
  })

  it('emits full schema operation shapes from builder methods', async () => {
    let adapter = new MemoryMigrationAdapter()
    let migration = createMigration({
      async up({ db, schema }) {
        let accountsTable = table({
          name: 'app.accounts',
          columns: {
            id: column
              .integer()
              .primaryKey()
              .references('auth.users', ['id'], 'accounts_user_fk')
              .onDelete('cascade')
              .onUpdate('restrict')
              .check('id > 0', 'accounts_id_check'),
            email: column.text().notNull().unique('accounts_email_uq'),
            nickname: column.text(),
          },
        })
        let accountsV2Table = table({
          name: 'app.accounts_v2',
          columns: {
            id: column.integer().primaryKey(),
          },
        })
        let authUsersTable = table({
          name: 'auth.users',
          columns: {
            id: column.integer().primaryKey(),
          },
        })
        await schema.createTable(accountsTable)
        await schema.createIndex(accountsTable, ['email', 'id'], {
          name: 'accounts_email_idx',
          ifNotExists: true,
          unique: true,
          where: 'id > 0',
          using: 'btree',
        })

        await schema.alterTable(accountsTable, (table) => {
          table.addColumn('status', column.text().default('active'))
          table.changeColumn('status', column.varchar(20).notNull())
          table.renameColumn('status', 'account_status')
          table.dropColumn('legacy_status', { ifExists: true })
          table.addPrimaryKey('id', { name: 'accounts_pk_v2' })
          table.dropPrimaryKey('accounts_pk_v2')
          table.addUnique(['account_status'], { name: 'accounts_status_uq' })
          table.dropUnique('accounts_status_uq')
          table.addForeignKey('id', accountsTable, 'id', { name: 'accounts_self_fk' })
          table.dropForeignKey('accounts_self_fk')
          table.addCheck("account_status in ('active', 'disabled')", {
            name: 'accounts_status_check',
          })
          table.dropCheck('accounts_status_check')
          table.addIndex(['account_status', 'id'], {
            name: 'accounts_status_idx',
            ifNotExists: true,
          })
          table.dropIndex('accounts_status_idx')
          table.comment('Accounts table v2')
        })

        let accountsExists = await schema.hasTable(accountsTable)
        let idColumnExists = await schema.hasColumn(accountsTable, 'id')

        if (!accountsExists || !idColumnExists) {
          throw new Error('Expected schema introspection checks to succeed')
        }

        await schema.renameTable(accountsTable, 'app.accounts_v2')
        await schema.dropTable(accountsV2Table, { ifExists: true, cascade: true })
        await schema.createIndex(accountsTable, ['id', 'email'], {
          name: 'accounts_compound_idx',
          unique: true,
        })
        await schema.dropIndex(accountsTable, 'accounts_compound_idx', { ifExists: true })
        await schema.renameIndex(accountsTable, 'accounts_old_idx', 'accounts_new_idx')
        await schema.addForeignKey(accountsTable, 'id', authUsersTable, undefined, {
          name: 'accounts_fk_global',
          onDelete: 'cascade',
          onUpdate: 'restrict',
        })
        await schema.dropForeignKey(accountsTable, 'accounts_fk_global')
        await schema.addCheck(accountsTable, 'id > 0', { name: 'accounts_global_check' })
        await schema.dropCheck(accountsTable, 'accounts_global_check')
        await schema.plan('analyze')
      },
      async down() {},
    })

    let runner = createMigrationRunner(adapter, [
      { id: '20260101000000', name: 'accounts', migration },
    ])
    await runner.up()

    let kinds = adapter.migratedOperations.map((operation) => operation.kind)
    assert.deepEqual(kinds, [
      'createTable',
      'createIndex',
      'alterTable',
      'createIndex',
      'dropIndex',
      'renameTable',
      'dropTable',
      'createIndex',
      'dropIndex',
      'renameIndex',
      'addForeignKey',
      'dropForeignKey',
      'addCheck',
      'dropCheck',
      'raw',
    ])

    let createIndexOperation = adapter.migratedOperations[1]
    assert.equal(createIndexOperation?.kind, 'createIndex')
    if (createIndexOperation.kind !== 'createIndex') {
      throw new Error('Expected createIndex operation at index 1')
    }
    assert.equal(createIndexOperation.ifNotExists, true)

    let alterTableOperation = adapter.migratedOperations[2]
    assert.equal(alterTableOperation?.kind, 'alterTable')
    if (alterTableOperation.kind !== 'alterTable') {
      throw new Error('Expected alterTable operation at index 2')
    }

    let addPrimaryKeyChange = alterTableOperation.changes.find(
      (change) => change.kind === 'addPrimaryKey',
    )
    assert.ok(addPrimaryKeyChange)
    if (!addPrimaryKeyChange || addPrimaryKeyChange.kind !== 'addPrimaryKey') {
      throw new Error('Expected addPrimaryKey change')
    }
    assert.deepEqual(addPrimaryKeyChange.constraint.columns, ['id'])

    let addForeignKeyChange = alterTableOperation.changes.find(
      (change) => change.kind === 'addForeignKey',
    )
    assert.ok(addForeignKeyChange)
    if (!addForeignKeyChange || addForeignKeyChange.kind !== 'addForeignKey') {
      throw new Error('Expected addForeignKey change')
    }
    assert.deepEqual(addForeignKeyChange.constraint.columns, ['id'])
    assert.deepEqual(addForeignKeyChange.constraint.references.columns, ['id'])

    let alterCreateIndexOperation = adapter.migratedOperations[3]
    assert.equal(alterCreateIndexOperation?.kind, 'createIndex')
    if (alterCreateIndexOperation.kind !== 'createIndex') {
      throw new Error('Expected createIndex operation at index 3')
    }
    assert.equal(alterCreateIndexOperation.ifNotExists, true)

    let addForeignKeyOperation = adapter.migratedOperations[10]
    assert.equal(addForeignKeyOperation?.kind, 'addForeignKey')
    if (addForeignKeyOperation.kind !== 'addForeignKey') {
      throw new Error('Expected addForeignKey operation at index 10')
    }
    assert.deepEqual(addForeignKeyOperation.constraint.columns, ['id'])
    assert.deepEqual(addForeignKeyOperation.constraint.references.columns, ['id'])
  })

  it('uses the same transaction token for migrate, exec, and introspection', async () => {
    let adapter = new MemoryMigrationAdapter()
    let migration = createMigration({
      transaction: 'required',
      async up({ db, schema }) {
        await schema.createTable(createIdTable('users'))
        await db.exec(rawSql('select 1'))
        await schema.hasTable('users')
        await schema.hasColumn('users', 'id')
      },
      async down() {},
    })

    let runner = createMigrationRunner(adapter, [
      { id: '20260101000000', name: 'tx_scope', migration },
    ])
    await runner.up()

    assert.equal(adapter.beginTransactionCount, 1)
    assert.equal(adapter.commitTransactionCount, 1)
    assert.equal(adapter.rollbackTransactionCount, 0)

    let migrateTokenIds = adapter.migrateTransactionIds.filter((id) => id !== undefined)
    assert.ok(migrateTokenIds.length > 0)
    assert.ok(migrateTokenIds.every((id) => id === migrateTokenIds[0]))

    let executeTokenIds = adapter.executeTransactionIds.filter((id) => id !== undefined)
    assert.ok(executeTokenIds.length > 0)
    assert.ok(executeTokenIds.every((id) => id === migrateTokenIds[0]))

    let hasTableTokenIds = adapter.hasTableTransactionIds.filter((id) => id !== undefined)
    assert.ok(hasTableTokenIds.length > 0)
    assert.ok(hasTableTokenIds.every((id) => id === migrateTokenIds[0]))

    let hasColumnTokenIds = adapter.hasColumnTransactionIds.filter((id) => id !== undefined)
    assert.ok(hasColumnTokenIds.length > 0)
    assert.ok(hasColumnTokenIds.every((id) => id === migrateTokenIds[0]))
  })

  it('uses live adapter introspection during dryRun without simulating planned operations', async () => {
    let adapter = new MemoryMigrationAdapter()
    adapter.knownTables.set('app.users', new Set(['email']))

    let migration = createMigration({
      async up({ db, schema }) {
        let existingTable = await schema.hasTable('app.users')
        let existingColumn = await schema.hasColumn('app.users', 'email')
        let plannedTableBefore = await schema.hasTable('app.pending')

        await schema.createTable(createIdTable('app.pending'))

        let plannedTableAfter = await schema.hasTable('app.pending')

        if (!existingTable || !existingColumn || plannedTableBefore || plannedTableAfter) {
          throw new Error('Unexpected dry-run introspection behavior')
        }
      },
      async down() {},
    })

    let runner = createMigrationRunner(adapter, [
      { id: '20260101000000', name: 'dry_run', migration },
    ])
    await runner.up({ dryRun: true })
  })

  it('throws when a dryRun migration attempts to use db.exec', async () => {
    let adapter = new MemoryMigrationAdapter()
    let migration = createMigration({
      async up({ db, schema }) {
        await db.exec(rawSql('select 1'))
      },
      async down() {},
    })

    let runner = createMigrationRunner(adapter, [
      { id: '20260101000000', name: 'dry_run_exec', migration },
    ])
    await assert.rejects(
      () => runner.up({ dryRun: true }),
      (error: unknown) =>
        error instanceof Error &&
        error.message === 'Adapter execution failed' &&
        'cause' in error &&
        error.cause instanceof Error &&
        error.cause.message ===
          'Cannot execute data operations while running migrations with dryRun',
    )
  })

  it('allows compiling SQL through the dryRun database adapter', async () => {
    let adapter = new MemoryMigrationAdapter()
    let migration = createMigration({
      async up({ db, schema }) {
        let compiled = db.adapter.compileSql({
          kind: 'raw',
          sql: rawSql('select 1'),
        })

        if (compiled.length !== 1 || compiled[0]?.text !== 'raw') {
          throw new Error('Unexpected compiled SQL shape')
        }
      },
      async down() {},
    })

    let runner = createMigrationRunner(adapter, [
      { id: '20260101000000', name: 'dry_run_compile', migration },
    ])
    await runner.up({ dryRun: true })
  })

  it('throws when a dryRun migration attempts to open a transaction', async () => {
    let adapter = new MemoryMigrationAdapter()
    let migration = createMigration({
      async up({ db, schema }) {
        await db.transaction(async () => {})
      },
      async down() {},
    })

    let runner = createMigrationRunner(adapter, [
      { id: '20260101000000', name: 'dry_run_transaction', migration },
    ])
    await assert.rejects(
      () => runner.up({ dryRun: true }),
      /Cannot execute data operations while running migrations with dryRun/,
    )
  })

  it('reads dryRun journal rows when the migration journal table already exists', async () => {
    let adapter = new MemoryMigrationAdapter()
    adapter.journalTableCreated = true
    adapter.journalRows = [
      {
        id: '20250101000000',
        name: 'legacy',
        checksum: 'legacy:legacy',
        batch: 1,
        applied_at: new Date().toISOString(),
      },
    ]

    let migration = createMigration({
      async up({ db, schema }) {
        await schema.createTable(createIdTable('users'))
      },
      async down() {},
    })

    let runner = createMigrationRunner(adapter, [
      { id: '20260101000000', name: 'users', migration },
    ])
    let result = await runner.up({ dryRun: true })

    assert.deepEqual(
      result.applied.map((entry) => entry.id),
      ['20260101000000'],
    )
    assert.deepEqual(result.sql, [{ text: 'createTable', values: [] }])
  })

  it('ignores journal rows for migrations that are no longer registered', async () => {
    let adapter = new MemoryMigrationAdapter()
    adapter.journalTableCreated = true
    adapter.journalRows = [
      {
        id: '20200101000000',
        name: 'orphaned',
        checksum: 'orphaned:orphaned',
        batch: 1,
        applied_at: new Date().toISOString(),
      },
    ]

    let migration = createMigration({
      async up() {},
      async down() {},
    })

    let runner = createMigrationRunner(adapter, [
      { id: '20260101000000', name: 'current', migration },
    ])
    await runner.up({ dryRun: true })
  })

  it('reports drifted status entries when journal checksum does not match migration checksum', async () => {
    let adapter = new MemoryMigrationAdapter()
    let migration = createMigration({
      async up() {},
      async down() {},
    })

    let runner = createMigrationRunner(adapter, [
      {
        id: '20260101000000',
        name: 'users',
        checksum: 'checksum_a',
        migration,
      },
    ])

    await runner.up()

    let driftedRunner = createMigrationRunner(adapter, [
      {
        id: '20260101000000',
        name: 'users',
        checksum: 'checksum_b',
        migration,
      },
    ])

    let statuses = await driftedRunner.status()
    assert.deepEqual(
      statuses.map((status) => status.status),
      ['drifted'],
    )
  })
})

describe('migration registry', () => {
  it('defaults transaction mode to auto when omitted', () => {
    let migration = createMigration({
      async up() {},
      async down() {},
    })

    assert.equal(migration.transaction, 'auto')
  })

  it('accepts explicit transaction mode values', () => {
    let migration = createMigration({
      transaction: 'none',
      async up() {},
      async down() {},
    })

    assert.equal(migration.transaction, 'none')
  })

  it('sorts migrations by id and rejects duplicate ids', () => {
    let first = {
      id: '20260101000000',
      name: 'first',
      migration: createMigration({ async up() {}, async down() {} }),
    }
    let second = {
      id: '20260102000000',
      name: 'second',
      migration: createMigration({ async up() {}, async down() {} }),
    }

    let registry = createMigrationRegistry([second, first])
    assert.deepEqual(
      registry.list().map((migration) => migration.id),
      ['20260101000000', '20260102000000'],
    )

    assert.throws(
      () =>
        createMigrationRegistry([
          first,
          {
            ...first,
            name: 'duplicate',
          },
        ]),
      /Duplicate migration id/,
    )

    assert.throws(
      () =>
        registry.register({
          ...first,
          name: 'duplicate',
        }),
      /Duplicate migration id/,
    )
  })

  it('works when migration runners are created from a registry input', async () => {
    let adapter = new MemoryMigrationAdapter()
    let registry = createMigrationRegistry()

    registry.register({
      id: '20260101000000',
      name: 'users',
      migration: createMigration({
        async up({ db, schema }) {
          await schema.createTable(createIdTable('users'))
        },
        async down() {},
      }),
    })

    let runner = createMigrationRunner(adapter, registry)
    await runner.up()

    assert.deepEqual(
      adapter.journalRows.map((row) => row.id),
      ['20260101000000'],
    )
  })
})

describe('migration filename parsing', () => {
  it('parses migration ids and names from standard filenames', () => {
    let parsed = parseMigrationFilename('20260101010101_create_users_table.ts')

    assert.deepEqual(parsed, {
      id: '20260101010101',
      name: 'create_users_table',
    })
  })

  it('rejects invalid migration filenames', () => {
    assert.throws(
      () => parseMigrationFilename('create_users_table.ts'),
      /Expected format YYYYMMDDHHmmss_name\.ts/,
    )
  })
})
