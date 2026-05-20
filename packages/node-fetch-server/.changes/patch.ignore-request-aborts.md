Drop handler responses when the client has already disconnected, and do not forward request abort errors from handlers or response streams to `onError` or write them to a closed socket (see #11431).
