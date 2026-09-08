Statically analyzable dynamic imports no longer add their module graphs to script entry preloads. Their import map entries are retained, and their modules are fetched when the import expression runs.
