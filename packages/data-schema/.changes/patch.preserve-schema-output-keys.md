Fix `object()` and `record()` results missing keys that passed validation. Declared fields, passthrough fields, and keys produced by record key transforms are now always own properties of the result.
