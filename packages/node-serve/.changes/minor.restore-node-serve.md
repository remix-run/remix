Restore `node-serve` with npm-published native transport packages. Installs automatically select the current OS and architecture without fetching GitHub dependencies (see #11873).

Request uploads stream with backpressure, response chunks are sent without waiting for a second chunk, and client disconnects cancel response streams. Request construction and pre-header stream failures use `onError`; committed stream failures close the connection (see #11963).
