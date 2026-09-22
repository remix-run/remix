BREAKING CHANGE: `MultipartParser.finish()` now returns the final part when a closing delimiter ends at EOF without CRLF. Direct users of `MultipartParser` must consume that return value in addition to the parts yielded by `write()`. `parseMultipart`, `parseMultipartStream`, and `parseMultipartRequest` handle this automatically (see #11901).

```diff
 let parser = new MultipartParser(boundary)
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

Validate ordinary and closing delimiter endings before delivering parts, including when delimiters span stream chunks. Accept optional space/tab padding, closing delimiters at EOF, and empty multipart messages. Ignore epilogues after the closing CRLF consistently across chunk boundaries.
