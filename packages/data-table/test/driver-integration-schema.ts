export type DriverIntegrationDialect = 'mysql' | 'postgres' | 'sqlite'

export type DriverIntegrationStatementRunner = (statement: string) => Promise<void>

type DriverIntegrationSchemaStatements = {
  drop: string[]
  create: string[]
  reset: string[]
}

const mysqlSchemaStatements: DriverIntegrationSchemaStatements = {
  drop: [
    'drop table if exists tasks',
    'drop table if exists projects',
    'drop table if exists accounts',
  ],
  create: [
    [
      'create table accounts (',
      '  id int primary key,',
      '  email varchar(255) not null,',
      '  status varchar(32) not null,',
      '  nickname varchar(255) null',
      ')',
    ].join('\n'),
    [
      'create table projects (',
      '  id int primary key,',
      '  account_id int not null,',
      '  name varchar(255) not null,',
      '  archived boolean not null',
      ')',
    ].join('\n'),
    [
      'create table tasks (',
      '  id int primary key,',
      '  project_id int not null,',
      '  title varchar(255) not null,',
      '  state varchar(32) not null',
      ')',
    ].join('\n'),
  ],
  reset: ['delete from tasks', 'delete from projects', 'delete from accounts'],
}

const postgresSchemaStatements: DriverIntegrationSchemaStatements = {
  drop: [
    'drop table if exists tasks',
    'drop table if exists projects',
    'drop table if exists accounts',
  ],
  create: [
    [
      'create table accounts (',
      '  id integer primary key,',
      '  email text not null,',
      '  status text not null,',
      '  nickname text',
      ')',
    ].join('\n'),
    [
      'create table projects (',
      '  id integer primary key,',
      '  account_id integer not null,',
      '  name text not null,',
      '  archived boolean not null',
      ')',
    ].join('\n'),
    [
      'create table tasks (',
      '  id integer primary key,',
      '  project_id integer not null,',
      '  title text not null,',
      '  state text not null',
      ')',
    ].join('\n'),
  ],
  reset: ['delete from tasks', 'delete from projects', 'delete from accounts'],
}

const sqliteSchemaStatements: DriverIntegrationSchemaStatements = {
  drop: [
    'drop table if exists tasks',
    'drop table if exists projects',
    'drop table if exists accounts',
  ],
  create: [
    [
      'create table accounts (',
      '  id integer primary key,',
      '  email text not null,',
      '  status text not null,',
      '  nickname text',
      ')',
    ].join('\n'),
    [
      'create table projects (',
      '  id integer primary key,',
      '  account_id integer not null,',
      '  name text not null,',
      '  archived boolean not null',
      ')',
    ].join('\n'),
    [
      'create table tasks (',
      '  id integer primary key,',
      '  project_id integer not null,',
      '  title text not null,',
      '  state text not null',
      ')',
    ].join('\n'),
  ],
  reset: ['delete from tasks', 'delete from projects', 'delete from accounts'],
}

export async function setupDriverIntegrationSchema(
  runStatement: DriverIntegrationStatementRunner,
  dialect: DriverIntegrationDialect,
): Promise<void> {
  let statements = getDriverIntegrationSchemaStatements(dialect)
  await runStatements(runStatement, [...statements.drop, ...statements.create])
}

export async function teardownDriverIntegrationSchema(
  runStatement: DriverIntegrationStatementRunner,
  dialect: DriverIntegrationDialect,
): Promise<void> {
  let statements = getDriverIntegrationSchemaStatements(dialect)
  await runStatements(runStatement, statements.drop)
}

export async function resetDriverIntegrationSchema(
  runStatement: DriverIntegrationStatementRunner,
  dialect: DriverIntegrationDialect,
): Promise<void> {
  let statements = getDriverIntegrationSchemaStatements(dialect)
  await runStatements(runStatement, statements.reset)
}

function getDriverIntegrationSchemaStatements(
  dialect: DriverIntegrationDialect,
): DriverIntegrationSchemaStatements {
  if (dialect === 'mysql') {
    return mysqlSchemaStatements
  }

  if (dialect === 'postgres') {
    return postgresSchemaStatements
  }

  return sqliteSchemaStatements
}

async function runStatements(
  runStatement: DriverIntegrationStatementRunner,
  statements: string[],
): Promise<void> {
  for (let statement of statements) {
    await runStatement(statement)
  }
}
