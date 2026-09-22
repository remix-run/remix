Reject malformed multipart delimiter endings instead of interpreting body content as additional parts. Validate ordinary delimiter endings before yielding parts, including across stream chunks. Accept optional space/tab padding, closing delimiters at EOF, and empty multipart messages, and ignore epilogues after the closing CRLF (see #11901).

`MultipartParser.write()` continues to yield every part, including the final part, and `finish()` validates completion without returning a value. Invalid closing suffixes are rejected even when the final part has already been delivered.
