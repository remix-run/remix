# testing

A browser-based test framework for Remix components and browser APIs.

## Features

- Run tests in a real browser via Playwright
- `describe`/`it` test structure with `beforeEach`/`afterEach`/`beforeAll`/`afterAll` hooks
- Built-in `assert` library with deep equality, throws/rejects support
- `render` helper for testing Remix components
- CLI with watch mode, headless/UI options, and VS Code stack trace links
- Full esbuild bundling — third-party npm packages work in test files

## Installation

```sh
npm i remix esbuild playwright tsx
```

## Usage

Write test files that import from `remix/testing`:

```ts
import { describe, it, assert, render } from 'remix/testing'

describe('MyComponent', () => {
  it('renders correctly', () => {
    let { $, cleanup } = render(<MyComponent />)
    assert.equal($('[data-testid="title"]')?.textContent, 'Hello')
    cleanup()
  })
})
```

Run tests with the CLI (headless by default):

```sh
remix-test "fixtures/*.test.{ts,tsx}"
```

### CLI Options

| Flag        | Short | Description                          |
| ----------- | ----- | ------------------------------------ |
| `--watch`   | `-w`  | Watch for file changes and re-run    |
| `--ui`      | `-u`  | Open browser UI (keeps browser open) |
| `--devtools`|       | Open browser devtools                |
| `--debug`   | `-d`  | Log browser console output           |
| `--port`    | `-p`  | Server port (default: 44101)         |

## API

### Test framework

```ts
import { describe, it, beforeEach, afterEach, beforeAll, afterAll } from 'remix/testing'
```

### Assertions

```ts
import { assert } from 'remix/testing'

assert.ok(value)
assert.equal(actual, expected)
assert.notEqual(actual, expected)
assert.deepEqual(actual, expected)
assert.throws(fn)
await assert.rejects(asyncFn)
```

All assertion functions are also available as named exports:

```ts
import { ok, equal, notEqual, deepEqual, throws, rejects } from 'remix/testing'
```

### render

```ts
import { render } from 'remix/testing'

let { $, $$, act, cleanup } = render(<MyComponent />)

$('[data-testid="foo"]')           // querySelector
$$('[data-testid="item"]')         // querySelectorAll
await act(() => button.click())    // trigger event and flush updates
cleanup()                          // unmount and remove from DOM
```

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
