BREAKING CHANGE: `MultipartPart.headers` is now a plain decoded object keyed by lower-case header name instead of a native `Headers` instance. Access part headers with bracket notation like `part.headers['content-type']` instead of `part.headers.get('content-type')`.

This lets multipart part headers preserve decoded UTF-8 field names and filenames that native `Headers` cannot store.
