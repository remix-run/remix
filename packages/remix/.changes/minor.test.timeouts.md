Expose `remix/test` timeout and abort signal support through the Remix package.

Tests and lifecycle hooks can pass `{ timeout, signal }`, and `t.signal` aborts when a test times out.
