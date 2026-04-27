import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  ansi,
  createStyles,
  createTerminal,
  shouldUseColors,
  stripAnsi,
  type TerminalOutputStream,
} from './terminal.ts'

describe('shouldUseColors', () => {
  it('uses explicit color options', () => {
    assert.equal(
      shouldUseColors({
        colors: true,
        env: { CI: 'true', NO_COLOR: '', TERM: 'dumb' },
        stream: { isTTY: false, write() {} },
      }),
      true,
    )
    assert.equal(
      shouldUseColors({ colors: false, env: { FORCE_COLOR: '1' }, stream: { write() {} } }),
      false,
    )
  })

  it('disables colors with NO_COLOR when colors are not explicit', () => {
    assert.equal(
      shouldUseColors({ env: { NO_COLOR: '' }, stream: { isTTY: true, write() {} } }),
      false,
    )
  })

  it('disables colors in CI when colors are not explicit', () => {
    assert.equal(
      shouldUseColors({ env: { CI: 'true' }, stream: { isTTY: true, write() {} } }),
      false,
    )
  })

  it('respects FORCE_COLOR when colors are not explicit', () => {
    assert.equal(shouldUseColors({ env: { FORCE_COLOR: '1' } }), true)
    assert.equal(
      shouldUseColors({ env: { FORCE_COLOR: '0' }, stream: { isTTY: true, write() {} } }),
      false,
    )
  })

  it('falls back to TTY support', () => {
    assert.equal(shouldUseColors({ env: {}, stream: { isTTY: true, write() {} } }), true)
    assert.equal(shouldUseColors({ env: {}, stream: { isTTY: false, write() {} } }), false)
  })

  it('disables colors for dumb terminals', () => {
    assert.equal(
      shouldUseColors({ env: { TERM: 'dumb' }, stream: { isTTY: true, write() {} } }),
      false,
    )
  })
})

describe('createStyles', () => {
  it('formats values with individual styles', () => {
    let styles = createStyles({ colors: true, env: {} })

    assert.equal(styles.enabled, true)
    assert.equal(styles.green('GET'), '\x1b[32mGET\x1b[39m')
    assert.equal(styles.bold('Remix'), '\x1b[1mRemix\x1b[22m')
    assert.equal(styles.italic('Remix'), '\x1b[3mRemix\x1b[23m')
    assert.equal(styles.strikethrough('Remix'), '\x1b[9mRemix\x1b[29m')
    assert.equal(styles.redBright('Remix'), '\x1b[91mRemix\x1b[39m')
    assert.equal(styles.bgBlue('Remix'), '\x1b[44mRemix\x1b[49m')
  })

  it('formats values with multiple styles', () => {
    let styles = createStyles({ colors: true, env: {} })

    assert.equal(
      styles.format('warning', 'dim', 'yellow'),
      '\x1b[2m\x1b[33mwarning\x1b[39m\x1b[22m',
    )
  })

  it('restores outer styles after nested styles close', () => {
    let styles = createStyles({ colors: true, env: {} })

    assert.equal(
      styles.red(`Error: ${styles.bold('fatal')} retrying`),
      '\x1b[31mError: \x1b[1mfatal\x1b[22m retrying\x1b[39m',
    )
    assert.equal(
      styles.red(`Error: ${styles.green('fatal')} retrying`),
      '\x1b[31mError: \x1b[32mfatal\x1b[39m\x1b[31m retrying\x1b[39m',
    )
    assert.equal(
      styles.bold(`Error: ${styles.dim('maybe')} retrying`),
      '\x1b[1mError: \x1b[2mmaybe\x1b[22m\x1b[1m retrying\x1b[22m',
    )
    assert.equal(
      styles.bgRed(`Error: ${styles.bgBlue('fatal')} retrying`),
      '\x1b[41mError: \x1b[44mfatal\x1b[49m\x1b[41m retrying\x1b[49m',
    )
  })

  it('restores outer styles after nested resets', () => {
    let styles = createStyles({ colors: true, env: {} })

    assert.equal(
      styles.red(`Error: ${ansi.reset}retrying`),
      '\x1b[31mError: \x1b[0m\x1b[31mretrying\x1b[39m',
    )
  })

  it('passes values through when colors are disabled', () => {
    let styles = createStyles({ colors: false, env: {} })

    assert.equal(styles.enabled, false)
    assert.equal(styles.reset, '')
    assert.equal(styles.red('Error'), 'Error')
    assert.equal(styles.format('warning', 'dim', 'yellow'), 'warning')
  })
})

describe('ansi', () => {
  it('generates cursor position sequences', () => {
    assert.equal(ansi.cursorTo(0), '\x1b[1G')
    assert.equal(ansi.cursorTo(4, 2), '\x1b[3;5H')
    assert.equal(ansi.cursorTo(-1, Number.NaN), '\x1b[1;1H')
  })

  it('generates cursor movement sequences', () => {
    assert.equal(ansi.moveCursor(2, 3), '\x1b[2C\x1b[3B')
    assert.equal(ansi.moveCursor(-2, -3), '\x1b[2D\x1b[3A')
    assert.equal(ansi.moveCursor(0, Number.NaN), '')
  })
})

describe('ANSI string helpers', () => {
  it('strips ANSI sequences', () => {
    assert.equal(stripAnsi('\x1b[31mError\x1b[0m'), 'Error')
    assert.equal(stripAnsi('\x1b]8;;https://remix.run\x07Remix\x1b]8;;\x07'), 'Remix')
  })
})

describe('createTerminal', () => {
  it('writes to injected output streams', () => {
    let stdout = createMemoryStream({ isTTY: true })
    let stderr = createMemoryStream()
    let terminal = createTerminal({
      colors: true,
      env: {},
      stdin: { isTTY: true },
      stdout,
      stderr,
    })

    assert.equal(terminal.isTTY, true)
    assert.equal(terminal.isInteractive, true)

    terminal.writeLine(terminal.styles.green('ok'))
    terminal.errorLine(terminal.styles.red('fail'))
    terminal.clearLine()
    terminal.cursorTo(0)
    terminal.hideCursor()
    terminal.showCursor()

    assert.equal(stdout.output, '\x1b[32mok\x1b[39m\n\x1b[2K\x1b[1G\x1b[?25l\x1b[?25h')
    assert.equal(stderr.output, '\x1b[31mfail\x1b[39m\n')
  })
})

interface MemoryStream extends TerminalOutputStream {
  output: string
}

function createMemoryStream(options: { isTTY?: boolean } = {}): MemoryStream {
  return {
    isTTY: options.isTTY,
    output: '',
    write(chunk) {
      this.output += chunk
    },
  }
}
