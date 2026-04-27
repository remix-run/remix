import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { ansi, ansiResetCode, ansiStyleCodes, stripAnsi } from './ansi.ts'

describe('ansi', () => {
  it('exposes raw style and control sequences', () => {
    assert.equal(ansi.reset, ansiResetCode)
    assert.equal(ansi.red, ansiStyleCodes.red)
    assert.equal(ansi.greenBright, ansiStyleCodes.greenBright)
    assert.equal(ansi.bgBlue, ansiStyleCodes.bgBlue)
    assert.equal(ansi.clearLine, '\x1b[2K')
    assert.equal(ansi.eraseDown, '\x1b[J')
    assert.equal(ansi.hideCursor, '\x1b[?25l')
    assert.equal(ansi.showCursor, '\x1b[?25h')
  })

  it('generates cursor position sequences', () => {
    assert.equal(ansi.cursorTo(0), '\x1b[1G')
    assert.equal(ansi.cursorTo(4, 2), '\x1b[3;5H')
    assert.equal(ansi.cursorTo(-1, Number.NaN), '\x1b[1;1H')
    assert.equal(ansi.cursorTo(2.8, 4.9), '\x1b[5;3H')
  })

  it('generates cursor movement sequences', () => {
    assert.equal(ansi.moveCursor(2, 3), '\x1b[2C\x1b[3B')
    assert.equal(ansi.moveCursor(-2, -3), '\x1b[2D\x1b[3A')
    assert.equal(ansi.moveCursor(2.8, -3.1), '\x1b[2C\x1b[3A')
    assert.equal(ansi.moveCursor(0, Number.NaN), '')
  })
})

describe('stripAnsi', () => {
  it('strips CSI and OSC escape sequences', () => {
    assert.equal(stripAnsi('\x1b[31mError\x1b[0m'), 'Error')
    assert.equal(stripAnsi('\x1b[1;31mError\x1b[0m'), 'Error')
    assert.equal(stripAnsi('\x1b]8;;https://remix.run\x07Remix\x1b]8;;\x07'), 'Remix')
    assert.equal(stripAnsi('\x1b]8;;https://remix.run\x1b\\Remix\x1b]8;;\x1b\\'), 'Remix')
  })
})
