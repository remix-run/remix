# testing

A browser-based test framework for Remix components and browser APIs.

## Features

- Run tests in a real browser via Playwright
- `describe`/`it` test structure with `beforeEach`/`afterEach`/`beforeAll`/`afterAll` hooks
- Built-in `assert` library with deep equality, throws/rejects support
- `render` helper for testing Remix components
- CLI with watch mode, headless/UI options, and VS Code stack trace links
- TypeScript and TSX support via esbuild transforms

## Installation

```sh
npm i remix esbuild playwright
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

Run tests with the CLI:

```sh
remix-test fixtures/*.test.{ts,tsx}
remix-test --headless fixtures/*.test.{ts,tsx}
remix-test --watch fixtures/*.test.{ts,tsx}
```

### CLI Options

| Flag | Short | Description |
|------|-------|-------------|
| `--headless` | `-h` | Run browser in headless mode |
| `--watch` | `-w` | Watch for file changes and re-run |
| `--ui` | `-u` | Open browser UI (keeps browser open) |
| `--devtools` | | Open browser devtools |
| `--debug` | `-d` | Log browser console output |
| `--port` | `-p` | Server port (default: 44101) |

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
