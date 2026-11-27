Finish single-chunk responses that include a matching `Content-Length` header directly with `res.end(chunk)` instead of calling `res.write()` followed by a separate `res.end()`.
