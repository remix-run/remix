Add support for executing both data manipulation operations and data migration operations in the sqlite adapter (`execute` for `DataManipulationOperation`, `migrate` for `DataMigrationOperation`), including adapter-level DDL execution support for migrations.

SQL compilation remains adapter-owned while sharing common helpers from `remix/data-table/sql-helpers`.
