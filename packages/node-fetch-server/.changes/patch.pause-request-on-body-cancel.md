Stop a request body that a handler cancels, or never reads before its response finishes, from being downloaded in full or holding up its connection.

Before, cancelling `request.body` kept reading the rest of the upload off the socket and discarding it, so a server that rejected a large upload still downloaded all of it. For example, a 50 MB upload rejected by `parseFormData()` from `remix/form-data-parser/future` at a 1 MB `maxTotalSize` was read in full. A body the handler never read was left unread instead, which stalled an HTTP/1.1 keep-alive connection until it timed out, so the client's next request on it failed.

Now the rest of an abandoned body is handled like this:

- HTTP/1.1, up to 1 MiB left (by `Content-Length`): read and discarded, so the connection serves the next request.
- HTTP/1.1, more than that or of unknown length: at most another 1 MiB is read. The response is sent with `Connection: close` when its headers have not been sent yet, and the connection is closed 2 seconds after the response, which gives the client time to read the response first.
- HTTP/2: no longer read. Once the whole response has been sent, the stream is reset with `NO_ERROR`, which tells the client to stop sending without failing the response.

A request body that was never read by the time the response finishes now rejects reads with an `AbortError`, so start reading it before the response finishes if you need it afterwards.

`request.signal` now also aborts when an HTTP/2 client disconnects before a response is sent. Before, it never aborted for an HTTP/2 request once its body stopped being read, including requests without a body.
