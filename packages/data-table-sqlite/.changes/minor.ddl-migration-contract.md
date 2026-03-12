Add first-class migration execution support to the sqlite adapter. It now compiles and executes `DataMigrationOperation` plans for `remix/data-table/migrations`, including create/alter/drop table and index flows, migration journal writes, and adapter-managed DDL execution for migrations.

Normal reads/writes continue through `execute(...)`, while migration/DDL work runs through `migrate(...)`.

SQL compilation remains adapter-owned and can share helpers from `remix/data-table/sql-helpers`.
