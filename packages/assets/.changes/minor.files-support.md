Add support for serving configured leaf file assets via a new `files` option in `createAssetServer()`.

Relative CSS `url()` references are now resolved through the asset server, rewriting supported file assets to asset server URLs and surfacing errors for missing or unsupported files.
