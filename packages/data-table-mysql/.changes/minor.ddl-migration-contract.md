Add support for executing both data manipulation operations and data migration operations in the mysql adapter (`execute` for `DataManipulationOperation`, `migrate` for `DataMigrationOperation`), including adapter-level migration locking support.

SQL compilation remains adapter-owned while sharing common helpers from `remix/data-table/sql-helpers`.
