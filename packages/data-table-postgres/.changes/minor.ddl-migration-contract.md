Add first-class migration execution support to the postgres adapter. It now compiles and executes `DataMigrationOperation` plans for `remix/data-table/migrations`, including create/alter/drop table and index flows, migration journal writes, and adapter-managed migration locking.

Normal reads/writes continue through `execute(...)`, while migration/DDL work runs through `migrate(...)`.

SQL compilation remains adapter-owned inside this package.
