# Browser Test Harness

A proof-of-concept in-browser testing harness that runs TypeScript tests in a real browser using Playwright automation. Similar to Vitest browser mode, but built from scratch with esbuild + custom server.

## Features

- **TypeScript Support**: Transforms TypeScript tests to JavaScript on-the-fly using esbuild
- **node:test Compatible**: Write tests using familiar `describe`/`it` syntax from Node.js
- **node:assert API**: Uses a browser-compatible assertion library matching `node:assert/strict`
- **Real Browser Testing**: Tests run in Chromium via Playwright (headless or visible)
- **Test Discovery**: Automatically finds test files via glob patterns
- **CLI Interface**: Simple command-line tool for running tests

## Architecture

```
CLI → Test Discovery → HTTP Server (port 44100)
                    ↓
        Playwright launches Chromium
                    ↓
        Browser loads test runner HTML
                    ↓
        Loads: test framework, assertions, test executor
                    ↓
        Transforms & executes test files
                    ↓
        Results collected via window.__testResults
                    ↓
        Formatted output in terminal
```

## Installation

```bash
cd demos/browser-test-harness
pnpm install
```

## Usage

### Run Example Tests

```bash
pnpm test:example
```

### Run Custom Test Pattern

```bash
pnpm test "**/*.test.ts"
```

### Debug Mode (Visible Browser)

```bash
tsx cli.ts --no-headless "fixtures/**/*.test.ts"
```

### Custom Port

```bash
tsx cli.ts --port 8080 "**/*.test.ts"
```

## Writing Tests

Tests use the same syntax as Node.js tests:

```typescript
import { describe, it } from 'node:test'
import * as assert from 'node:assert/strict'

describe('My Test Suite', () => {
  it('passes basic assertions', () => {
    assert.equal(1 + 1, 2)
  })

  it('works with async code', async () => {
    let result = await Promise.resolve(42)
    assert.equal(result, 42)
  })

  it('can test DOM APIs', () => {
    let div = document.createElement('div')
    div.textContent = 'Hello'
    assert.equal(div.textContent, 'Hello')
  })

  it('can test fetch API', async () => {
    let response = await fetch('data:text/plain,hello')
    let text = await response.text()
    assert.equal(text, 'hello')
  })
})
```

## Supported Assertions

The browser assertion library supports the following methods from `node:assert/strict`:

- `assert.ok(value, message?)` - Truthy assertion
- `assert.equal(actual, expected, message?)` - Strict equality (===)
- `assert.notEqual(actual, expected, message?)` - Strict inequality (!==)
- `assert.deepEqual(actual, expected, message?)` - Deep equality comparison
- `assert.throws(fn, expectedError?, message?)` - Synchronous error assertion
- `assert.rejects(fn, expectedError?, message?)` - Asynchronous error assertion

## Project Structure

```
demos/browser-test-harness/
├── cli.ts                      # CLI entry point
├── server.ts                   # HTTP server with esbuild transform
├── lib/
│   ├── transform.ts            # esbuild TypeScript → JavaScript
│   ├── test-discovery.ts       # Glob-based test file discovery
│   ├── test-runner.ts          # Playwright orchestration
│   └── result-collector.ts     # Result formatting and display
├── browser/
│   ├── test-framework.ts       # describe/it/beforeEach globals
│   ├── assertions.ts           # node:assert/strict compatible API
│   └── test-executor.ts        # Browser-side test execution
└── fixtures/
    └── example.test.ts         # Sample test file
```

## How It Works

1. **Test Discovery**: CLI discovers test files matching the glob pattern
2. **HTTP Server**: Starts server on port 44100 with three routes:
   - `/_test/:file` - HTML page that loads test framework + test file
   - `/_module/*` - Transforms and serves TypeScript test files
   - `/_browser/:module` - Serves browser runtime files
3. **Playwright**: Launches Chromium and navigates to test runner page
4. **Browser Execution**:
   - Sets up global `describe`, `it`, `assert` functions
   - Imports and executes test file
   - Runs all registered tests with proper lifecycle hooks
5. **Result Collection**: Browser sets `window.__testResults` when complete
6. **Display**: Playwright polls for results and displays formatted output

## Limitations (PoC)

This is a proof-of-concept with intentional simplifications:

- No nested `describe()` blocks
- Sequential test execution only (no parallelization)
- Basic deep equality implementation
- No watch mode
- No code coverage reporting
- Chromium only (no Firefox/WebKit support)
- No test filtering/grep functionality

## Key Implementation Details

### TypeScript Transformation

esbuild transforms TypeScript to JavaScript with:
- ESM format, ES2022 target, browser platform
- Inline sourcemaps for debugging
- Automatic removal of `node:test` and `node:assert/strict` imports (replaced with globals)
- Simple in-memory caching

### Browser Communication

Uses the simplest approach for PoC:
- Browser sets `window.__testResults` when tests complete
- Playwright uses `page.waitForFunction` to poll for results
- Results serialized as JSON and passed back to Node.js

### Route Handling

Uses Remix `fetch-router` for clean URL routing:
- Splat routes for dynamic file paths
- URL encoding/decoding for absolute paths
- Transform pipeline integrated into request handling

## Example Output

```
Found 1 test file(s)

Test server running on http://localhost:44100
Running: /Users/matt/me/repos/remix/demos/browser-test-harness/fixtures/example.test.ts
  ✓ 6 passed, ✗ 0 failed

============================================================
Test Results
============================================================

Example Test Suite:
  ✓ passes basic equality (0.10ms)
  ✓ passes deep equality (0.00ms)
  ✓ can test async code (0.00ms)
  ✓ can assert throws (0.10ms)

DOM Tests:
  ✓ can interact with DOM (0.30ms)
  ✓ can test fetch API (0.40ms)

============================================================
Total: 6 passed, 0 failed
============================================================
```

## Future Enhancements

Potential improvements beyond the PoC:

- Nested describe() support
- Parallel test execution
- Complete node:assert API implementation
- Watch mode with file watching (chokidar)
- Code coverage reporting (istanbul/c8)
- Multiple browser support (Firefox, WebKit)
- Test filtering (--grep flag)
- Custom reporters (JSON, TAP, JUnit)
- Setup/teardown files
- Better error messages and stack traces
- WebSocket-based communication for real-time updates

## License

MIT
