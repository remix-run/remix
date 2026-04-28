import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { ansi } from './ansi.ts'
import { createStyles } from './styles.ts'
import type { TerminalStyleName } from './ansi.ts'

describe('createStyles', () => {
  it('formats values with every named style helper', () => {
    let styles = createStyles({ colors: true, env: {} })
    let styleCases: Array<{ name: TerminalStyleName; expected: string }> = [
      { name: 'bold', expected: '\x1b[1mx\x1b[22m' },
      { name: 'dim', expected: '\x1b[2mx\x1b[22m' },
      { name: 'inverse', expected: '\x1b[7mx\x1b[27m' },
      { name: 'italic', expected: '\x1b[3mx\x1b[23m' },
      { name: 'overline', expected: '\x1b[53mx\x1b[55m' },
      { name: 'strikethrough', expected: '\x1b[9mx\x1b[29m' },
      { name: 'underline', expected: '\x1b[4mx\x1b[24m' },
      { name: 'black', expected: '\x1b[30mx\x1b[39m' },
      { name: 'blackBright', expected: '\x1b[90mx\x1b[39m' },
      { name: 'blue', expected: '\x1b[34mx\x1b[39m' },
      { name: 'blueBright', expected: '\x1b[94mx\x1b[39m' },
      { name: 'cyan', expected: '\x1b[36mx\x1b[39m' },
      { name: 'cyanBright', expected: '\x1b[96mx\x1b[39m' },
      { name: 'gray', expected: '\x1b[90mx\x1b[39m' },
      { name: 'green', expected: '\x1b[32mx\x1b[39m' },
      { name: 'greenBright', expected: '\x1b[92mx\x1b[39m' },
      { name: 'grey', expected: '\x1b[90mx\x1b[39m' },
      { name: 'magenta', expected: '\x1b[35mx\x1b[39m' },
      { name: 'magentaBright', expected: '\x1b[95mx\x1b[39m' },
      { name: 'red', expected: '\x1b[31mx\x1b[39m' },
      { name: 'redBright', expected: '\x1b[91mx\x1b[39m' },
      { name: 'white', expected: '\x1b[37mx\x1b[39m' },
      { name: 'whiteBright', expected: '\x1b[97mx\x1b[39m' },
      { name: 'yellow', expected: '\x1b[33mx\x1b[39m' },
      { name: 'yellowBright', expected: '\x1b[93mx\x1b[39m' },
      { name: 'bgBlack', expected: '\x1b[40mx\x1b[49m' },
      { name: 'bgBlackBright', expected: '\x1b[100mx\x1b[49m' },
      { name: 'bgBlue', expected: '\x1b[44mx\x1b[49m' },
      { name: 'bgBlueBright', expected: '\x1b[104mx\x1b[49m' },
      { name: 'bgCyan', expected: '\x1b[46mx\x1b[49m' },
      { name: 'bgCyanBright', expected: '\x1b[106mx\x1b[49m' },
      { name: 'bgGray', expected: '\x1b[100mx\x1b[49m' },
      { name: 'bgGreen', expected: '\x1b[42mx\x1b[49m' },
      { name: 'bgGreenBright', expected: '\x1b[102mx\x1b[49m' },
      { name: 'bgGrey', expected: '\x1b[100mx\x1b[49m' },
      { name: 'bgMagenta', expected: '\x1b[45mx\x1b[49m' },
      { name: 'bgMagentaBright', expected: '\x1b[105mx\x1b[49m' },
      { name: 'bgRed', expected: '\x1b[41mx\x1b[49m' },
      { name: 'bgRedBright', expected: '\x1b[101mx\x1b[49m' },
      { name: 'bgWhite', expected: '\x1b[47mx\x1b[49m' },
      { name: 'bgWhiteBright', expected: '\x1b[107mx\x1b[49m' },
      { name: 'bgYellow', expected: '\x1b[43mx\x1b[49m' },
      { name: 'bgYellowBright', expected: '\x1b[103mx\x1b[49m' },
    ]

    assert.equal(styles.enabled, true)
    assert.equal(styles.reset, ansi.reset)

    for (let { name, expected } of styleCases) {
      assert.equal(styles[name]('x'), expected)
    }
  })

  it('formats values with multiple styles', () => {
    let styles = createStyles({ colors: true, env: {} })

    assert.equal(styles.format('warning'), 'warning')
    assert.equal(
      styles.format('warning', 'dim', 'yellow'),
      '\x1b[2m\x1b[33mwarning\x1b[39m\x1b[22m',
    )
  })

  it('uses explicit color options before automatic detection', () => {
    assert.equal(
      createStyles({
        colors: true,
        env: { CI: 'true', NO_COLOR: '', TERM: 'dumb' },
        stream: { isTTY: false },
      }).enabled,
      true,
    )
    assert.equal(
      createStyles({
        colors: false,
        env: { FORCE_COLOR: '1' },
        stream: { isTTY: true },
      }).enabled,
      false,
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
