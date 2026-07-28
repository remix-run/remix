---
title: Data and Validation
description: How Remix validates inputs, defines relational data, queries databases, and runs SQL migrations.
---

Follow one value from an untrusted request into a validated action payload and then into a typed database write. Request validation and table validation solve different problems and should stay separate in the reader's model.

## Validate every trust boundary {#validating-trust-boundaries}

Parse route params, query strings, forms, JSON bodies, cookies, and external service payloads before business logic uses them. Prefer `parseSafe()` in actions when invalid input should become a `400` response; reserve thrown parse errors for boundaries that truly cannot continue.

## Schemas, parsing, and issues {#remix-data-schema}

Introduce `remix/data-schema` through objects, primitives, optional/defaulted values, unions and variants, and `parse()` versus `parseSafe()`. Cover issue paths, error maps, type inference, and compatibility with other Standard Schema v1 schemas without duplicating the complete API README.

## Checks, refinements, transforms, and coercion {#coercion-and-checks}

Use `.pipe(...)` with reusable checks, `.refine(...)` for domain predicates, `.transform(...)` when validated output changes shape, and `remix/data-schema/coerce` for string inputs that should become numbers, booleans, dates, or bigints.

## FormData and URLSearchParams schemas {#form-parsing-with-remix-data-schema-form-data}

Use `f.object`, `f.field`, and `f.fields` for browser form and query-string values, plus `f.file` and `f.files` for uploads. Pair form schemas with `formData()` middleware so parsing happens once and actions read a typed boundary value from context.

## Define tables, columns, and relations {#tables-with-remix-data-table}

Define typed tables with `table()` and column builders, then model `belongsTo`, `hasOne`, `hasMany`, and through relations. Be explicit that runtime table metadata does not create database constraints: SQL migrations own DDL.

## CRUD helpers and query objects {#queries-and-crud-helpers}

Use `find`, `findOne`, `findMany`, `create`, `update`, and `delete` for common work. Move to standalone `query(...)` plus `db.exec(...)`, or bound `db.query(...)`, for joins, projections, aggregates, eager relation loading, scoped bulk writes, and reusable query objects. Keep parameterized raw SQL as an escape hatch.

## Table validation and lifecycle hooks {#table-validation-and-lifecycle-hooks}

Cover `beforeWrite`, table-level `validate`, `afterWrite`, `beforeDelete`, `afterDelete`, and `afterRead`, including their synchronous behavior and partial row shapes. Request schemas validate external input; table hooks enforce persistence invariants across every caller.

## Transactions {#transactions}

Use `db.transaction()` when a set of reads and writes must commit or roll back together. Note that lifecycle hooks do not create implicit transactions and that adapters may expose transaction-specific options.

## SQLite, PostgreSQL, and MySQL adapters {#sqlite-postgres-and-mysql-adapters}

Show the shared `createDatabase(adapter)` shape, then call out runtime-specific SQLite clients, PostgreSQL transaction options, and MySQL's `RETURNING` and multi-statement limitations where those differences affect app code.

## SQL-first migrations {#migrations}

Use timestamped migration directories with required `up.sql` and optional `down.sql`. Cover filesystem loading, journaling and checksum drift, `up`/`down`, bounded steps or target IDs, dry-run plans, and per-migration transaction modes.

## Request-scoped database access {#request-scoped-database-access}

Initialize the database and run migrations before accepting requests, then expose `Database` through middleware and derive the app context type from that stack. Actions should read the request-scoped database with `context.get(Database)` or the typed context property installed by the app.
