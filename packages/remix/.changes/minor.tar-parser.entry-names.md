BREAKING CHANGE: `remix/tar-parser` now defaults to `pathPolicy: 'relative'`, rejecting invalid entry names and link targets with `TarParseError`. Entry names must be relative without parent components; symlink and hard-link targets must stay within the archive when resolved from the link's parent and archive root, respectively. Set `pathPolicy: 'preserve'` to process unrestricted decoded paths while retaining archive limits and header structure validation:

```diff
-await parseTar(archive, handleEntry)
+await parseTar(archive, { pathPolicy: 'preserve' }, handleEntry)
```

See the [tar-parser changelog](https://github.com/remix-run/remix/blob/main/packages/tar-parser/CHANGELOG.md) for details.
