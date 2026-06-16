import { sql, type SqlStatement } from '../src/lib/sql.ts'

export type AdapterIntegrationStatementRunner = (statement: SqlStatement) => Promise<void>

type AdapterIntegrationSchemaStatements = {
  drop: SqlStatement[]
  create: SqlStatement[]
}

const schemaStatements: AdapterIntegrationSchemaStatements = {
  drop: [
    sql`drop table if exists tasks`,
    sql`drop table if exists projects`,
    sql`drop table if exists accounts`,
  ],
  create: [
    sql`
      create table accounts (
        id integer primary key,
        email text not null,
        status text not null,
        nickname text
      )
    `,
    sql`
      create table projects (
        id integer primary key,
        account_id integer not null,
        name text not null,
        archived boolean not null
      )
    `,
    sql`
      create table tasks (
        id integer primary key,
        project_id integer not null,
        title text not null,
        state text not null
      )
    `,
  ],
}

export async function setupAdapterIntegrationSchema(
  runStatement: AdapterIntegrationStatementRunner,
): Promise<void> {
  await runStatements(runStatement, [...schemaStatements.drop, ...schemaStatements.create])
}

export async function teardownAdapterIntegrationSchema(
  runStatement: AdapterIntegrationStatementRunner,
): Promise<void> {
  await runStatements(runStatement, schemaStatements.drop)
}

async function runStatements(
  runStatement: AdapterIntegrationStatementRunner,
  statements: SqlStatement[],
): Promise<void> {
  for (let statement of statements) {
    await runStatement(statement)
  }
}
