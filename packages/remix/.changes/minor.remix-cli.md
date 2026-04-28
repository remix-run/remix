Added `package.json` exports and binaries for the Remix CLI:

- `remix/cli` to expose the Remix CLI programmatic API
- `remix` as a `package.json` `bin` command that delegates to `@remix-run/cli`

The Remix CLI now reads the current Remix version from the `remix` package and declares Node.js 24.3.0 or later in package metadata.
