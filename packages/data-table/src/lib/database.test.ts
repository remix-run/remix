import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import type { DatabaseAdapter } from './adapter.ts'
import { column } from './column.ts'
import { createDatabase, Database } from './database.ts'
import { DataTableAdapterError, DataTableQueryError, DataTableValidationError } from './errors.ts'
import { table, hasMany, timestamps } from './table.ts'
import { eq } from './operators.ts'
import { createRecordingAdapter } from '../../test/recording-adapter.ts'

const accounts = table({
  name: 'accounts',
  columns: {
    id: column.integer(),
    email: column.text(),
    status: column.text(),
    ...timestamps(),
  },
  timestamps: true,
  validate({ value }) {
    if ('id' in value && typeof value.id !== 'number') {
      return { issues: [{ message: 'Expected number', path: ['id'] }] }
    }

    if ('email' in value && typeof value.email !== 'string') {
      return { issues: [{ message: 'Expected string', path: ['email'] }] }
    }

    if ('status' in value && typeof value.status !== 'string') {
      return { issues: [{ message: 'Expected string', path: ['status'] }] }
    }

    return { value }
  },
})

const projects = table({
  name: 'projects',
  columns: {
    id: column.integer(),
    account_id: column.integer(),
    name: column.text(),
    archived: column.boolean(),
  },
})

const tasks = table({
  name: 'tasks',
  columns: {
    id: column.integer(),
    project_id: column.integer(),
    title: column.text(),
    state: column.text(),
  },
})

const accountProjects = hasMany(accounts, projects)

describe('queries', () => {
  it('supports direct construction and createDatabase wrapper', async () => {
    let firstAdapter = createRecordingAdapter({
      async execute() {
        return { rows: [{ id: 1, email: 'amy@studio.test', status: 'active' }] }
      },
    })
    let secondAdapter = createRecordingAdapter({
      async execute() {
        return { rows: [{ id: 2, email: 'brad@studio.test', status: 'inactive' }] }
      },
    })
    let direct = new Database(firstAdapter.adapter, {
      now() {
        return '2026-01-01T00:00:00.000Z'
      },
    })
    let wrapped = createDatabase(secondAdapter.adapter, {
      now() {
        return '2026-01-01T00:00:00.000Z'
      },
    })

    let directRows = await direct.query(accounts).all()
    let wrappedRows = await wrapped.query(accounts).all()

    assert.equal(direct instanceof Database, true)
    assert.equal(wrapped instanceof Database, true)
    assert.equal(direct.now(), '2026-01-01T00:00:00.000Z')
    assert.equal(wrapped.now(), '2026-01-01T00:00:00.000Z')
    assert.deepEqual(
      firstAdapter.requests.map((request) => request.operation.kind),
      ['select'],
    )
    assert.deepEqual(
      secondAdapter.requests.map((request) => request.operation.kind),
      ['select'],
    )
    assert.equal(directRows.length, 1)
    assert.equal(wrappedRows.length, 1)
  })

  it('returns null from database-level find helper for nullish primary keys', async () => {
    let recording = createRecordingAdapter()
    let db = createTestDatabase(recording.adapter)
    let nullResult = await db.find(accounts, null as never)
    let undefinedResult = await db.find(accounts, undefined as never)

    assert.equal(nullResult, null)
    assert.equal(undefinedResult, null)
  })

  it('throws from database-level update helper when row is missing', async () => {
    let recording = createRecordingAdapter({
      async execute(request) {
        if (request.operation.kind === 'update') {
          return { affectedRows: 0 }
        }

        return { rows: [] }
      },
    })
    let db = createTestDatabase(recording.adapter)

    await assert.rejects(
      async function () {
        await db.update(accounts, 999, { status: 'active' })
      },
      function (error: unknown) {
        return (
          error instanceof DataTableQueryError &&
          error.message === 'update() failed to find row for table "accounts"'
        )
      },
    )
  })

  it('does not pre-read when update helper uses RETURNING', async () => {
    let recording = createRecordingAdapter({
      async execute(request) {
        if (request.operation.kind === 'update') {
          return {
            rows: [
              {
                id: 1,
                email: 'amy@studio.test',
                status: 'inactive',
              },
            ],
            affectedRows: 1,
          }
        }

        throw new Error('unexpected operation kind: ' + request.operation.kind)
      },
    })

    let db = createTestDatabase(recording.adapter)
    let updated = await db.update(accounts, 1, { status: 'inactive' })

    assert.equal(updated.id, 1)
    assert.deepEqual(
      recording.requests.map((request) => request.operation.kind),
      ['update'],
    )
  })

  it('does not throw on no-op updates for non-RETURNING adapters when row still exists', async () => {
    let recording = createRecordingAdapter({
      capabilities: { returning: false },
      async execute(request) {
        if (request.operation.kind === 'update') {
          return {
            affectedRows: 0,
          }
        }

        if (request.operation.kind === 'select') {
          return {
            rows: [
              {
                id: 1,
                email: 'amy@studio.test',
                status: 'active',
              },
            ],
          }
        }

        throw new Error('unexpected operation kind: ' + request.operation.kind)
      },
    })

    let db = createTestDatabase(recording.adapter)
    let updated = await db.update(accounts, 1, { status: 'active' })

    assert.equal(updated.id, 1)
    assert.equal(updated.status, 'active')
    assert.deepEqual(
      recording.requests.map((request) => request.operation.kind),
      ['update', 'select'],
    )
  })

  it('throws for createMany() batches with only empty rows', async () => {
    let recording = createRecordingAdapter()
    let db = createTestDatabase(recording.adapter)

    await assert.rejects(
      async function () {
        await db.createMany(tasks, [{}, {}])
      },
      function (error: unknown) {
        return (
          error instanceof DataTableQueryError &&
          error.message === 'insertMany() requires at least one explicit value across the batch'
        )
      },
    )
  })

  it('throws for insertMany() batches with only empty rows', async () => {
    let recording = createRecordingAdapter()
    let db = createTestDatabase(recording.adapter)

    await assert.rejects(
      async function () {
        await db.query(tasks).insertMany([{}])
      },
      function (error: unknown) {
        return (
          error instanceof DataTableQueryError &&
          error.message === 'insertMany() requires at least one explicit value across the batch'
        )
      },
    )
  })

  it('supports insertMany() batches that include at least one explicit value', async () => {
    let recording = createRecordingAdapter({
      async execute(request) {
        if (request.operation.kind === 'insertMany') {
          return {
            affectedRows: request.operation.values.length,
          }
        }

        return {}
      },
    })

    let db = createTestDatabase(recording.adapter)
    let result = await db.query(tasks).insertMany([{}, { title: 'hello world' }])

    assert.equal(result.affectedRows, 2)
    assert.equal(recording.requests.length, 1)
    assert.equal(recording.requests[0].operation.kind, 'insertMany')
  })

  it('throws for createMany({ returnRows: true }) when adapter has no RETURNING support', async () => {
    let recording = createRecordingAdapter({ capabilities: { returning: false } })
    let db = createTestDatabase(recording.adapter)

    await assert.rejects(
      async function () {
        await db.createMany(accounts, [{ id: 1, email: 'a@studio.test', status: 'active' }], {
          returnRows: true,
        })
      },
      function (error: unknown) {
        return (
          error instanceof DataTableQueryError &&
          error.message === 'createMany({ returnRows: true }) is not supported by this adapter'
        )
      },
    )
  })
})

describe('writes and validation', () => {
  it('validates values and applies timestamps', async () => {
    let createdAt = '2026-01-15T10:00:00.000Z'
    let recording = createRecordingAdapter({
      async execute(request) {
        if (request.operation.kind === 'insert') {
          return {
            rows: [request.operation.values],
            affectedRows: 1,
          }
        }

        return {}
      },
    })
    let db = createDatabase(recording.adapter, {
      now() {
        return createdAt
      },
    })

    let insertResult = await db.query(accounts).insert(
      {
        id: 10,
        email: 'ops@studio.test',
        status: 'active',
      },
      { returning: ['id', 'email'] },
    )

    if ('row' in insertResult) {
      assert.equal(insertResult.row?.id, 10)
      assert.equal(insertResult.row?.email, 'ops@studio.test')
    } else {
      assert.fail('Expected row in insert result')
    }

    assert.equal(recording.requests[0].operation.kind, 'insert')
    if (recording.requests[0].operation.kind === 'insert') {
      assert.deepEqual(recording.requests[0].operation.values.created_at, createdAt)
      assert.deepEqual(recording.requests[0].operation.values.updated_at, createdAt)
    }

    await assert.rejects(
      async function () {
        await db
          .query(accounts)
          .insert({ id: 11, email: 'billing@studio.test', status: 300 as never })
      },
      function (error: unknown) {
        return (
          error instanceof DataTableValidationError &&
          error.metadata?.operation === 'create' &&
          error.metadata?.source === 'validate'
        )
      },
    )
  })

  it('passes create/update operation context to table validators', async () => {
    let operations: Array<'create' | 'update'> = []
    let validatedAccounts = table({
      name: 'accounts',
      columns: {
        id: column.integer(),
        email: column.text(),
        status: column.text(),
        ...timestamps(),
      },
      timestamps: true,
      validate({ operation, value }) {
        operations.push(operation)
        return { value }
      },
    })

    let recording = createRecordingAdapter({
      async execute(request) {
        if (request.operation.kind === 'select' || request.operation.kind === 'update') {
          return { rows: [{ id: 1, email: 'a@studio.test', status: 'inactive' }], affectedRows: 1 }
        }

        return { affectedRows: 1 }
      },
    })
    let db = createTestDatabase(recording.adapter)

    await db.create(validatedAccounts, { id: 2, email: 'b@studio.test', status: 'active' })
    await db.createMany(validatedAccounts, [{ id: 3, email: 'c@studio.test', status: 'active' }])
    await db.update(validatedAccounts, 1, { status: 'inactive' })
    await db.updateMany(
      validatedAccounts,
      { status: 'active' },
      {
        where: { id: 2 },
      },
    )

    assert.deepEqual(operations, ['create', 'create', 'update', 'update'])
  })

  it('uses create operation for both upsert payloads', async () => {
    let operations: Array<'create' | 'update'> = []
    let validatedAccounts = table({
      name: 'accounts',
      columns: {
        id: column.integer(),
        email: column.text(),
        status: column.text(),
      },
      validate({ operation, value }) {
        operations.push(operation)
        return { value }
      },
    })

    let recording = createRecordingAdapter({
      capabilities: { returning: false },
      async execute() {
        return { affectedRows: 1 }
      },
    })

    let db = createDatabase(recording.adapter)
    await db
      .query(validatedAccounts)
      .upsert(
        { id: 1, email: 'a@studio.test', status: 'inactive' },
        { conflictTarget: ['id'], update: { status: 'active' } },
      )

    assert.deepEqual(operations, ['create', 'create'])
  })

  it('rejects unknown columns before and after table validation', async () => {
    let strictAccounts = table({
      name: 'accounts',
      columns: {
        id: column.integer(),
        email: column.text(),
        status: column.text(),
        created_at: column.text(),
        updated_at: column.text(),
      },
      validate({ value }) {
        return {
          value: {
            ...value,
            ghost: true,
          },
        }
      },
    })
    let recording = createRecordingAdapter()
    let db = createTestDatabase(recording.adapter)

    await assert.rejects(
      async () => {
        await db.create(strictAccounts, { id: 1, email: 'a@studio.test', status: 'active' })
      },
      (error: unknown) =>
        error instanceof DataTableValidationError &&
        error.message === 'Unknown column "ghost" for table "accounts"',
    )

    await assert.rejects(
      async () => {
        await db.create(strictAccounts, {
          id: 1,
          email: 'a@studio.test',
          status: 'active',
          unknown: true,
        } as never)
      },
      (error: unknown) =>
        error instanceof DataTableValidationError &&
        error.message === 'Unknown column "unknown" for table "accounts"',
    )
  })

  it('runs beforeWrite -> validate -> touch -> afterWrite for create', async () => {
    let callbackOrder: string[] = []
    let validateSawTouchedColumn = false
    let writeTrackedAccounts = table({
      name: 'accounts',
      columns: {
        id: column.integer(),
        email: column.text(),
        status: column.text(),
        ...timestamps(),
      },
      timestamps: true,
      beforeWrite({ value }) {
        callbackOrder.push('beforeWrite')
        return {
          value: {
            ...value,
            status: String(value.status).toUpperCase(),
          },
        }
      },
      validate({ value }) {
        callbackOrder.push('validate')
        validateSawTouchedColumn = Object.prototype.hasOwnProperty.call(value, 'created_at')
        return { value }
      },
      afterWrite({ values }) {
        callbackOrder.push('afterWrite')
        let payload = values[0] as Record<string, unknown>
        assert.equal(payload.status, 'ACTIVE')
        assert.equal(payload.created_at, '2026-01-01T00:00:00.000Z')
      },
    })

    let recording = createRecordingAdapter({
      async execute(request) {
        if (request.operation.kind === 'insert') {
          return { rows: [request.operation.values], affectedRows: 1 }
        }

        return {}
      },
    })
    let db = createTestDatabase(recording.adapter)

    await db.create(writeTrackedAccounts, {
      id: 1,
      email: 'ops@studio.test',
      status: 'active',
    })

    assert.equal(validateSawTouchedColumn, false)
    assert.deepEqual(callbackOrder, ['beforeWrite', 'validate', 'afterWrite'])
  })

  it('passes scoped delete context to callbacks', async () => {
    let beforeDeleteCalls: Array<{
      tableName: string
      whereLength: number
      orderByColumn?: string
      orderByDirection?: string
      limit?: number
    }> = []
    let deleteTrackedAccounts = table({
      name: 'accounts',
      columns: {
        id: column.integer(),
        email: column.text(),
        status: column.text(),
      },
      beforeDelete(context) {
        beforeDeleteCalls.push({
          tableName: context.tableName,
          whereLength: context.where.length,
          orderByColumn: context.orderBy[0]?.column,
          orderByDirection: context.orderBy[0]?.direction,
          limit: context.limit,
        })
      },
    })

    let recording = createRecordingAdapter({
      async execute(request) {
        if (request.operation.kind === 'select') {
          return { rows: [{ id: 1, email: 'amy@studio.test', status: 'active' }] }
        }

        if (request.operation.kind === 'delete') {
          return { affectedRows: 1 }
        }

        return {}
      },
    })
    let db = createTestDatabase(recording.adapter)

    await db
      .query(deleteTrackedAccounts)
      .where({ status: 'active' })
      .orderBy('id', 'asc')
      .limit(1)
      .delete()

    assert.equal(recording.requests[0].operation.kind, 'select')
    assert.equal(
      recording.requests.some((request) => request.operation.kind === 'delete'),
      true,
    )
    assert.deepEqual(beforeDeleteCalls, [
      {
        tableName: 'accounts',
        whereLength: 1,
        orderByColumn: 'id',
        orderByDirection: 'asc',
        limit: 1,
      },
    ])
  })

  it('allows beforeDelete to veto deletes with issues', async () => {
    let vetoedAccounts = table({
      name: 'accounts',
      columns: {
        id: column.integer(),
        email: column.text(),
        status: column.text(),
      },
      beforeDelete() {
        return {
          issues: [{ message: 'Deletes are disabled' }],
        }
      },
    })

    let recording = createRecordingAdapter()
    let db = createTestDatabase(recording.adapter)

    await assert.rejects(
      async () => {
        await db.query(vetoedAccounts).where({ id: 1 }).delete()
      },
      (error: unknown) =>
        error instanceof DataTableValidationError &&
        error.message === 'Invalid value for table "accounts"' &&
        error.metadata?.operation === 'delete' &&
        error.metadata?.source === 'beforeDelete',
    )
  })

  it('includes callback source metadata for afterRead issues', async () => {
    let issueAfterReadAccounts = table({
      name: 'accounts',
      columns: {
        id: column.integer(),
        email: column.text(),
        status: column.text(),
      },
      afterRead() {
        return {
          issues: [{ message: 'Row rejected' }],
        }
      },
    })

    let recording = createRecordingAdapter({
      async execute() {
        return { rows: [{ id: 1, email: 'amy@studio.test', status: 'active' }] }
      },
    })
    let db = createTestDatabase(recording.adapter)

    await assert.rejects(
      async () => {
        await db.find(issueAfterReadAccounts, 1)
      },
      (error: unknown) =>
        error instanceof DataTableValidationError &&
        error.message === 'Invalid value for table "accounts"' &&
        error.metadata?.operation === 'read' &&
        error.metadata?.source === 'afterRead',
    )
  })

  it('passes projected row shapes to afterRead callbacks', async () => {
    let sawMissingStatus = false
    let projectedAccounts = table({
      name: 'accounts',
      columns: {
        id: column.integer(),
        email: column.text(),
        status: column.text(),
      },
      afterRead({ value }) {
        sawMissingStatus = !('status' in value)
        return { value }
      },
    })

    let recording = createRecordingAdapter({
      async execute() {
        return { rows: [{ id: 1 }] }
      },
    })
    let db = createTestDatabase(recording.adapter)

    let rows = await db.query(projectedAccounts).select({ id: projectedAccounts.id }).all()

    assert.equal(rows.length, 1)
    assert.equal(rows[0].id, 1)
    assert.equal(sawMissingStatus, true)
  })

  it('applies afterRead to root rows, related rows, and write-returning rows', async () => {
    let readableAccounts = table({
      name: 'accounts',
      columns: {
        id: column.integer(),
        email: column.text(),
        status: column.text(),
      },
      afterRead({ value }) {
        return {
          value: {
            ...value,
            email: typeof value.email === 'string' ? value.email.toUpperCase() : value.email,
          },
        }
      },
    })
    let recording = createRecordingAdapter({
      async execute(request) {
        if (request.operation.kind === 'insert') {
          return { rows: [request.operation.values], affectedRows: 1 }
        }

        return { rows: [{ id: 1, email: 'amy@studio.test', status: 'active' }] }
      },
    })
    let db = createTestDatabase(recording.adapter)

    let rows = await db.query(readableAccounts).all()
    assert.equal(rows[0].email, 'AMY@STUDIO.TEST')

    let insertResult = await db
      .query(readableAccounts)
      .insert({ id: 2, email: 'new@studio.test', status: 'active' }, { returning: '*' })

    if ('row' in insertResult && insertResult.row) {
      assert.equal(insertResult.row.email, 'NEW@STUDIO.TEST')
    } else {
      assert.fail('Expected row in insert result')
    }
  })

  it('enforces synchronous lifecycle callbacks', async () => {
    let asyncBeforeWriteAccounts = table({
      name: 'accounts',
      columns: {
        id: column.integer(),
        email: column.text(),
        status: column.text(),
      },
      beforeWrite({ value }) {
        return Promise.resolve({ value }) as never
      },
    })
    let asyncAfterReadAccounts = table({
      name: 'accounts',
      columns: {
        id: column.integer(),
        email: column.text(),
        status: column.text(),
      },
      afterRead({ value }) {
        return Promise.resolve({ value }) as never
      },
    })

    let recording = createRecordingAdapter({
      async execute() {
        return { rows: [{ id: 1, email: 'amy@studio.test', status: 'active' }] }
      },
    })
    let db = createTestDatabase(recording.adapter)

    await assert.rejects(
      async () => {
        await db.create(asyncBeforeWriteAccounts, { id: 2, email: 'new@studio.test' })
      },
      (error: unknown) =>
        error instanceof DataTableValidationError &&
        error.message === 'Invalid beforeWrite callback result for table "accounts"' &&
        error.metadata?.source === 'beforeWrite',
    )

    await assert.rejects(
      async () => {
        await db.find(asyncAfterReadAccounts, 1)
      },
      (error: unknown) =>
        error instanceof DataTableValidationError &&
        error.message === 'Invalid afterRead callback result for table "accounts"' &&
        error.metadata?.source === 'afterRead',
    )
  })

  it('throws for invalid beforeDelete callback return values', async () => {
    let invalidBeforeDeleteAccounts = table({
      name: 'accounts',
      columns: {
        id: column.integer(),
        email: column.text(),
        status: column.text(),
      },
      beforeDelete() {
        return { value: { allowed: false } } as never
      },
    })
    let recording = createRecordingAdapter()
    let db = createTestDatabase(recording.adapter)

    await assert.rejects(
      async () => {
        await db.query(invalidBeforeDeleteAccounts).where({ id: 1 }).delete()
      },
      (error: unknown) =>
        error instanceof DataTableValidationError &&
        error.message === 'Invalid beforeDelete callback result for table "accounts"' &&
        error.metadata?.source === 'beforeDelete',
    )
  })

  it('throws for update returning when adapter has no RETURNING support', async () => {
    let recording = createRecordingAdapter({ capabilities: { returning: false } })
    let db = createTestDatabase(recording.adapter)

    await assert.rejects(
      async () => {
        await db
          .query(accounts)
          .where({ status: 'active' })
          .orderBy('id', 'asc')
          .limit(1)
          .update({ status: 'inactive' }, { returning: ['id', 'status'] })
      },
      (error: unknown) =>
        error instanceof DataTableQueryError &&
        error.message === 'update() returning is not supported by this adapter',
    )
  })

  it('throws for delete returning when adapter has no RETURNING support', async () => {
    let recording = createRecordingAdapter({ capabilities: { returning: false } })
    let db = createTestDatabase(recording.adapter)

    await assert.rejects(
      async () => {
        await db
          .query(accounts)
          .where({ status: 'active' })
          .orderBy('id', 'asc')
          .limit(1)
          .delete({ returning: ['id'] })
      },
      (error: unknown) =>
        error instanceof DataTableQueryError &&
        error.message === 'delete() returning is not supported by this adapter',
    )
  })

  it('throws for write returning when adapter has no RETURNING support', async () => {
    let recording = createRecordingAdapter({ capabilities: { returning: false } })
    let db = createTestDatabase(recording.adapter)

    await assert.rejects(
      async () => {
        await db.query(accounts).insert(
          {
            id: 2,
            email: 'finance@studio.test',
            status: 'active',
          },
          { returning: ['id', 'email'] },
        )
      },
      (error: unknown) =>
        error instanceof DataTableQueryError &&
        error.message === 'insert() returning is not supported by this adapter',
    )

    await assert.rejects(
      async () => {
        await db.query(accounts).insertMany(
          [
            { id: 2, email: 'finance@studio.test', status: 'active' },
            { id: 3, email: 'ops@studio.test', status: 'active' },
          ],
          { returning: ['id', 'email'] },
        )
      },
      (error: unknown) =>
        error instanceof DataTableQueryError &&
        error.message === 'insertMany() returning is not supported by this adapter',
    )

    await assert.rejects(
      async () => {
        await db.query(accounts).upsert(
          {
            id: 1,
            email: 'founder@studio.test',
            status: 'inactive',
          },
          { returning: ['id', 'status'] },
        )
      },
      (error: unknown) =>
        error instanceof DataTableQueryError &&
        error.message === 'upsert() returning is not supported by this adapter',
    )
  })

  it('throws for upsert() when adapter does not support it', async () => {
    let recording = createRecordingAdapter({ capabilities: { upsert: false } })
    let db = createTestDatabase(recording.adapter)

    await assert.rejects(
      async function () {
        await db
          .query(accounts)
          .upsert({ id: 1, email: 'a@studio.test', status: 'active' }, { conflictTarget: ['id'] })
      },
      function (error: unknown) {
        return error instanceof DataTableQueryError
      },
    )
  })

  it('throws when read-only query modifiers are used with write terminals', async () => {
    let recording = createRecordingAdapter()
    let db = createTestDatabase(recording.adapter)

    await assert.rejects(
      async function () {
        await db
          .query(accounts)
          .join(projects, eq('accounts.id', 'projects.account_id'))
          .update({ status: 'inactive' })
      },
      function (error: unknown) {
        return (
          error instanceof DataTableQueryError &&
          error.message.includes('update() does not support these query modifiers: join()')
        )
      },
    )

    await assert.rejects(
      async function () {
        await db.query(accounts).groupBy('status').delete()
      },
      function (error: unknown) {
        return (
          error instanceof DataTableQueryError &&
          error.message.includes('delete() does not support these query modifiers: groupBy()')
        )
      },
    )

    await assert.rejects(
      async function () {
        await db
          .query(accounts)
          .with({ projects: accountProjects })
          .upsert({ id: 1, email: 'a@studio.test', status: 'active' })
      },
      function (error: unknown) {
        return (
          error instanceof DataTableQueryError &&
          error.message.includes('upsert() does not support these query modifiers: with()')
        )
      },
    )
  })

  it('throws when scoped query modifiers are used with insert-like terminals', async () => {
    let recording = createRecordingAdapter()
    let db = createTestDatabase(recording.adapter)

    await assert.rejects(
      async function () {
        await db.query(accounts).where({ id: 1 }).insert({
          id: 2,
          email: 'b@studio.test',
          status: 'active',
        })
      },
      function (error: unknown) {
        return (
          error instanceof DataTableQueryError &&
          error.message.includes('insert() does not support these query modifiers: where()')
        )
      },
    )

    await assert.rejects(
      async function () {
        await db
          .query(accounts)
          .orderBy('id', 'asc')
          .insertMany([{ id: 3, email: 'c@studio.test', status: 'active' }])
      },
      function (error: unknown) {
        return (
          error instanceof DataTableQueryError &&
          error.message.includes('insertMany() does not support these query modifiers: orderBy()')
        )
      },
    )

    await assert.rejects(
      async function () {
        await db.query(accounts).limit(1).upsert({
          id: 1,
          email: 'a@studio.test',
          status: 'inactive',
        })
      },
      function (error: unknown) {
        return (
          error instanceof DataTableQueryError &&
          error.message.includes('upsert() does not support these query modifiers: limit()')
        )
      },
    )
  })

  it('does not validate filter values at runtime', async () => {
    let recording = createRecordingAdapter({
      async execute() {
        return { affectedRows: 1 }
      },
    })
    let db = createTestDatabase(recording.adapter)

    await db
      .query(accounts)
      .where({ id: 'not-a-number' as never })
      .all()

    await db
      .query(accounts)
      .join(projects, eq('projects.archived', 'nope' as never))
      .all()

    await db
      .query(accounts)
      .groupBy('status')
      .having(eq('status', 123 as never))
      .count()
  })
})

describe('transactions and raw sql', () => {
  it('rejects database lifecycle operations from transaction callbacks', async () => {
    let recording = createRecordingAdapter()
    let db = createTestDatabase(recording.adapter)

    await db.transaction(async (transactionDatabase) => {
      await assert.rejects(
        () => transactionDatabase.wipe(),
        /Cannot call wipe\(\) from a transaction-scoped database/,
      )
      await assert.rejects(
        () => transactionDatabase.migrate([]),
        /Cannot call migrate\(\) from a transaction-scoped database/,
      )
      await assert.rejects(
        () => transactionDatabase.migrationStatus([]),
        /Cannot call migrationStatus\(\) from a transaction-scoped database/,
      )
      await assert.rejects(
        () => transactionDatabase.reset({ migrations: [] }),
        /Cannot call reset\(\) from a transaction-scoped database/,
      )
      await assert.rejects(
        () => transactionDatabase.close(),
        /Cannot call close\(\) from a transaction-scoped database/,
      )
    })
  })

  it('treats transaction options as best-effort adapter hints', async () => {
    let recording = createRecordingAdapter({
      async execute() {
        return { affectedRows: 1 }
      },
    })
    let db = createTestDatabase(recording.adapter)

    await db.transaction(
      async (transactionDatabase) => {
        await transactionDatabase
          .query(accounts)
          .insert({ id: 2, email: 'pm@studio.test', status: 'active' })
      },
      {
        isolationLevel: 'serializable',
        readOnly: true,
      },
    )

    assert.equal(recording.transactions[0].kind, 'begin')
    if (recording.transactions[0].kind === 'begin') {
      assert.deepEqual(recording.transactions[0].options, {
        isolationLevel: 'serializable',
        readOnly: true,
      })
    }
    assert.equal(recording.requests[0].transaction?.id, recording.transactions[0].token.id)
  })

  it('throws for nested transactions without savepoints', async () => {
    let recording = createRecordingAdapter({ capabilities: { savepoints: false } })
    let db = createTestDatabase(recording.adapter)

    await assert.rejects(
      async function () {
        await db.transaction(async (transactionDatabase) => {
          await transactionDatabase.transaction(async () => undefined)
        })
      },
      function (error: unknown) {
        return error instanceof DataTableQueryError
      },
    )
  })
})

describe('connection lifecycle', () => {
  it('closes the adapter when it implements close()', async () => {
    let recording = createRecordingAdapter()
    let closeCount = 0
    recording.adapter.close = () => {
      closeCount++
    }
    let db = createTestDatabase(recording.adapter)

    await db.close()

    assert.equal(closeCount, 1)
  })

  it('resolves for adapters without close()', async () => {
    let recording = createRecordingAdapter()
    let db = createTestDatabase(recording.adapter)

    await db.close()
  })
})

describe('adapter errors', () => {
  it('wraps adapter failures in DataTableAdapterError', async () => {
    let recording = createRecordingAdapter({
      dialect: 'failing',
      async execute() {
        throw new Error('boom')
      },
    })

    let db = createTestDatabase(recording.adapter)

    await assert.rejects(
      async function () {
        await db.query(accounts).all()
      },
      function (error: unknown) {
        if (!(error instanceof DataTableAdapterError)) {
          return false
        }

        return (
          error.metadata?.dialect === 'failing' &&
          error.metadata?.operationKind === 'select' &&
          error.cause instanceof Error &&
          error.cause.message === 'boom'
        )
      },
    )
  })
})

function createTestDatabase(adapter: DatabaseAdapter) {
  return new Database(adapter, {
    now() {
      return '2026-01-01T00:00:00.000Z'
    },
  })
}
