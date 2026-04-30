# terminal

Terminal output utilities for JavaScript libraries and CLIs. It provides small primitives for ANSI styles, color support detection, escape sequences, and testable stdout/stderr handling.

## Features

- **ANSI Styles** - Apply common modifiers, foreground colors, and background colors
- **Color Detection** - Respect `CI`, `NO_COLOR`, `FORCE_COLOR`, `TERM=dumb`, TTY streams, and explicit style overrides
- **Terminal Controls** - Generate escape sequences for cursor movement, line clearing, and cursor visibility
- **Testable Streams** - Create terminal instances around injected stdout/stderr/stdin streams

## Installation

```sh
npm i remix
```

## Usage

```ts
import { createTerminal } from 'remix/terminal'

let terminal = createTerminal()

terminal.writeLine(`${terminal.styles.green('ready')} listening on port 3000`)
terminal.errorLine(terminal.styles.red('failed to start'))
```

### ANSI Styles

Use `createStyles` when you only need formatting helpers.

```ts
import { createStyles } from 'remix/terminal'

let styles = createStyles({ colors: true })

console.log(styles.bold(styles.cyan('Ready')))
console.log(styles.format('warning', 'dim', 'yellow', 'bgBlackBright'))
```

Style helpers preserve outer styles when nested formatted strings close an inner style.

```ts
console.log(styles.red(`Error: ${styles.bold('fatal')} retrying`))
```

Supported modifiers include `bold`, `dim`, `italic`, `underline`, `overline`, `inverse`, and `strikethrough`. Supported colors include the base foreground/background ANSI colors, bright variants, and `gray`/`grey` aliases.

By default, color detection disables styles in CI, when `NO_COLOR` is present, for `TERM=dumb`, and outside TTY output streams. Set `colors` to `true` or `false` to override automatic detection.

### Terminal Controls

Use `ansi` for raw terminal escape sequences.

```ts
import { ansi } from 'remix/terminal'

process.stdout.write(ansi.clearLine)
process.stdout.write(ansi.cursorTo(0))
process.stdout.write('Updated status')
```

### Testing Output

Inject streams to test terminal output without writing to the real console.

```ts
import { createTerminal } from 'remix/terminal'

let output = ''

let terminal = createTerminal({
  colors: false,
  stdout: {
    write(chunk) {
      output += chunk
    },
  },
})

terminal.writeLine(terminal.styles.green('ok'))
```

## Related Packages

- [`logger-middleware`](https://github.com/remix-run/remix/tree/main/packages/logger-middleware) - HTTP request/response logging middleware
- [`test`](https://github.com/remix-run/remix/tree/main/packages/test) - Browser-based test framework for Remix components

## License

See [LICENSE](https://github.com/remix-run/remix/blob/main/LICENSE)
