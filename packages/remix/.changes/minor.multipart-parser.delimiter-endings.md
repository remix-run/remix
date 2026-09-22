BREAKING CHANGE: Direct `MultipartParser` users in `remix/multipart-parser` and `remix/multipart-parser/node` must consume the optional final part returned by `finish()`. Higher-level multipart parsing functions handle this automatically. See the [multipart parser documentation](https://github.com/remix-run/remix/tree/main/packages/multipart-parser#low-level-api) for the full example.

```diff
 for (let chunk of chunks) {
   for (let part of parser.write(chunk)) {
     handlePart(part)
   }
 }
-parser.finish()
+let finalPart = parser.finish()
+if (finalPart !== undefined) {
+  handlePart(finalPart)
+}
```
