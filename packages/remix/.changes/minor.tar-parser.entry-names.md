BREAKING CHANGE: `remix/tar-parser` now defaults to `entryNamePolicy: 'relative'`, rejecting empty entry names, absolute paths, parent traversal, Windows drive prefixes, backslashes, and embedded NULs with `TarParseError`. Set `entryNamePolicy: 'preserve'` to process unrestricted decoded names while retaining archive limits and header structure validation:

```diff
-await parseTar(archive, handleEntry)
+await parseTar(archive, { entryNamePolicy: 'preserve' }, handleEntry)
```

See the [tar-parser changelog](https://github.com/remix-run/remix/blob/main/packages/tar-parser/CHANGELOG.md) for details.
