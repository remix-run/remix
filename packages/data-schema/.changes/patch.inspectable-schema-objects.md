Use about a third of the memory per schema and build schemas much faster, by keeping each schema's rules as data on the schema object instead of in validator closures.

Schema methods and `~standard` are now shared through the schema's prototype, and `~standard` is created the first time it is read. Pass a schema itself rather than a copy made with object spread (`{ ...schema }`), and don't change an `object()` shape after creating the schema; neither use is supported.
