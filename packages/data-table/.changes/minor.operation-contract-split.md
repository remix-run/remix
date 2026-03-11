BREAKING CHANGE: Rename adapter operation contracts and fields.

`AdapterStatement` becomes `DataManipulationOperation`, and `statement` becomes `operation`.

Add separate adapter execution methods for DML and migration/DDL operations: `execute` for `DataManipulationOperation` requests and `migrate` for `DataMigrationOperation` requests.

Add adapter introspection methods with optional transaction context: `hasTable(table, transaction?)` and `hasColumn(table, column, transaction?)`.
