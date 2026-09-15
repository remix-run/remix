BREAKING CHANGE: `parseTar()` and `TarParser` now default to limits of 2 MiB per entry body, 20 MiB of total archive input, and 5,000 entries, where previously none were limited. Applications processing larger archives must configure `maxEntrySize`, `maxTotalSize`, and `maxEntries` to raise the applicable limits, or set any limit to `Infinity` to disable it:

```diff
-await parseTar(archive, handleEntry)
+await parseTar(
+  archive,
+  { maxEntrySize: Infinity, maxTotalSize: Infinity, maxEntries: Infinity },
+  handleEntry,
+)
```

The entry size and count limits include PAX/GNU metadata entries and are checked before reading their bodies or invoking entry handlers. Padding and end markers do not count as entries. The total size limit counts all input bytes, including headers, padding, and metadata, after any upstream decompression. Exceeding a limit throws the exported `MaxEntrySizeExceededError`, `MaxTotalSizeExceededError`, or `MaxEntriesExceededError`, all extending `TarParseError`.

Global PAX metadata now applies to subsequent entries even without a local PAX header, so global sizes are parsed and checked against the entry limit. Local PAX values continue to take precedence.
