BREAKING CHANGE: `parseTarHeader()`, `parseTar()`, and `TarParser` now default to `pathPolicy: 'relative'`, throwing `TarParseError` for empty entry names or link targets, absolute paths, Windows drive prefixes, backslashes, and embedded NULs. Entry names cannot contain `..` path components. Symlink targets are checked relative to the link's parent directory, and hard-link targets relative to the archive root; `..` components are allowed only when resolution stays within the archive. Valid paths retain their spelling, including nested paths, `./` prefixes, and trailing directory slashes. Applications that need to inspect or process unrestricted archive paths can opt into `pathPolicy: 'preserve'`:

```diff
-await parseTar(archive, handleEntry)
+await parseTar(archive, { pathPolicy: 'preserve' }, handleEntry)
```

The same option works with `parseTarHeader()` and `new TarParser()`. It does not disable archive limits or header structure validation. Path validation applies after ustar prefixes and GNU/PAX overrides, before an entry reaches the handler. GNU long names and link targets now omit their terminating NUL under either policy. Extractors must still enforce containment on their destination filesystem, including when existing or archived symlinks are present.
