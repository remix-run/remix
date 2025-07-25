This is the monorepo for Remix, a cutting edge web framework.

In addition to this file, see `CONTRIBUTING.md` for further guidelines about developing in this repository.

## Package Structure

- All packages are contained in the `./packages` dir
- Each package has its own isolated dependencies and build process
- Common directory structure:
  - `src/` contains source files
  - `src/lib/` contains implementation files
  - Test files are named `*.test.ts` and located alongside source files
- Each package contains a `README.md` with an introduction, goals, feature set, usage patterns, etc.
- Each package contains a `CHANGELOG.md` that describes changes that have been made in each release
  - Unreleased changes go in a section with the `HEAD` heading

## Development

All tests run directly on source files without building first.

When making changes to a package (adding new features or fixing bugs), include an accompanying entry in the package's `CHANGELOG.md` describing the change. Include a small snippet that demonstrates intended usage when applicable.

Also, check its `README.md` to ensure all examples are still relevant and up to date, and consider adding meaningful examples for new features.

## Common Commands

```sh
# Install dependencies
$ pnpm install

# Run all tests
$ pnpm test

# Run tests for a specific package
$ pnpm --filter @remix-run/headers run test

# Build all packages
$ pnpm run build

# Build a specific package
$ pnpm --filter @remix-run/headers run build
```

## Testing

- Use `node:test` and `describe/it` style to organize test suites
- Make assertions using `node:assert/strict`
- Test files are named `*.test.ts` and located alongside source files
- Run tests with: `pnpm --filter <package-name> run test`
- Tests automatically clean up test directories in `afterEach` hooks
- Always verify that tests pass after making changes

## Releasing

A package needs to be released if the topmost section in its `CHANGELOG.md` begins with `## HEAD`. This means that there are features and/or bug fixes in the head of the development line that haven't been published yet.

The release process is a two-step process. First, we tag a release. Then, we publish it.

To cut a release:

```sh
# To bump the headers package to the next minor release
$ pnpm run tag-release headers minor

# Then publish it using the newly created tag
$ pnpm run publish-release headers@1.1.0
```

## Code Patterns and Style

- Prefer `let` for all variables, unless they are defined in global or module-level scope
- Only make comments to explain unusual code, do not comment on obvious code
- Use private fields with `#` prefix for class internals (e.g., `#dirname`)
- Imports: Use `node:` prefix for Node.js built-in modules (e.g., `node:fs`, `node:path`)
- TypeScript: Define explicit types for function parameters and return values

## Package-Specific Notes

### @remix-run/fetch-proxy

- Creates fetch-like functions that forward requests to target servers with automatic URL path concatenation
- Built-in cookie rewriting for proper domain/path handling in proxy contexts
- Preserves all request properties and optionally adds X-Forwarded headers
- Useful for building API gateways, reverse proxies, or request forwarding scenarios

### @remix-run/file-storage

- LocalFileStorage stores files in hash-based subdirectories (using first 2 chars of SHA-256 hash)
- Each file has two parts: `.dat` (data) and `.meta.json` (metadata)
- Empty directories should be cleaned up after file removal
- The storage directory structure prevents filesystem limitations with too many files in one directory

### @remix-run/form-data-parser

- Handles multipart form data parsing
- Integrates with file storage implementations for handling file uploads

### @remix-run/headers

- Utilities for working with HTTP headers

### @remix-run/lazy-file

- Provides `LazyFile` and `LazyBlob` classes that defer content loading until needed, ideal for large files
- Seamlessly extends native `File`/`Blob` APIs - can be used anywhere regular File/Blob objects are expected
- Filesystem integration via `openFile()` and `writeFile()` functions that stream content
- Efficient slicing with byte ranges without loading data into memory

### @remix-run/multipart-parser

- Universal JavaScript with zero dependencies, works in any JS environment (Node, Deno, Bun, Workers)
- Streaming architecture yields parts as found rather than buffering entire request
- Built-in file size protection with configurable limits (maxFileSize, maxHeaderSize)
- High-level `parseMultipartRequest()` API automatically validates and parses multipart requests

### @remix-run/node-fetch-server

- Build Node.js HTTP servers using web-standard Request/Response objects instead of req/res
- Drop-in compatible with http.createServer(), https.createServer(), and HTTP/2
- Built-in streaming support for efficient handling of large payloads
- Optional access to client connection info (IP, port) and custom hostname configuration

### @remix-run/route-pattern

- Full URL matching beyond just pathnames - includes protocol, hostname, pathname, and search params
- Rich pattern features: params (:name), globs (\*name), optionals (pattern), and enums {jpg,png,gif}
- Zero dependencies and runtime agnostic - works everywhere
- Smart pattern parsing automatically detects URL components based on pattern structure

### @remix-run/tar-parser

- Streaming-first architecture built on Web Streams API, processes without buffering entire archive
- Comprehensive format support: POSIX (ustar), GNU (with long filenames), and PAX formats
- Simple async handler API - each TarEntry provides header metadata and body stream
- Zero dependencies and platform agnostic - runs in any JavaScript environment
