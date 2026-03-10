Allow client `resolveFrame(...)` callbacks to return `RemixNode` content in addition to HTML strings and streams.

This lets apps render local frame fallback and recovery UI directly from the client runtime without manually serializing HTML, and frame updates now clear previously rendered HTML before mounting the new node-based content.
