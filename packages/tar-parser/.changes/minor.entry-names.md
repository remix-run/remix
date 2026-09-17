BREAKING CHANGE: `parseTarHeader()`, `parseTar()`, and `TarParser` now default to `entryNamePolicy: 'relative'`, throwing `TarParseError` for empty entry names, absolute paths, `..` path components, Windows drive prefixes, backslashes, and embedded NULs. Nested paths, `./` prefixes, and trailing directory slashes remain supported without normalization. Applications that need to inspect or process unrestricted archive names can opt into `entryNamePolicy: 'preserve'`:

```diff
-await parseTar(archive, handleEntry)
+await parseTar(archive, { entryNamePolicy: 'preserve' }, handleEntry)
```

The same option works with `parseTarHeader()` and `new TarParser()`. It does not disable archive limits or header structure validation. Name validation applies after ustar prefixes and GNU/PAX overrides, before an entry reaches the handler. GNU long names now omit their terminating NUL under either policy. Link targets remain unvalidated metadata, and extractors must still enforce containment on their destination filesystem, including when symlinks are present.
