Cancel unfinished streaming response bodies when the client connection closes before the response completes so user-provided `ReadableStream.cancel()` hooks run for aborted requests (see #11432).
