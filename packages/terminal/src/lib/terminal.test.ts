import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { createTerminal, type TerminalOutputStream } from './terminal.ts'

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

  it('uses the configured color-detection stream', () => {
    let stdout = createMemoryStream({ isTTY: false })
    let terminal = createTerminal({
      env: {},
      stdout,
      stream: { isTTY: true },
    })

    assert.equal(terminal.styles.enabled, true)
    terminal.writeLine(terminal.styles.green('ok'))

    assert.equal(stdout.output, '\x1b[32mok\x1b[39m\n')
  })

  it('reports TTY and interactivity from injected streams', () => {
    assert.equal(
      createTerminal({
        env: {},
        stdin: { isTTY: true },
        stdout: createMemoryStream({ isTTY: true }),
      }).isInteractive,
      true,
    )
    assert.equal(
      createTerminal({
        env: {},
        stdin: { isTTY: false },
        stdout: createMemoryStream({ isTTY: true }),
      }).isInteractive,
      false,
    )
    assert.equal(
      createTerminal({
        env: {},
        stdin: { isTTY: true },
        stdout: createMemoryStream({ isTTY: false }),
      }).isTTY,
      false,
    )
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
