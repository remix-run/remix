import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { ansi, stripAnsi } from './lib/ansi.ts'
import { shouldUseColors } from './lib/env.ts'
import { createStyles } from './lib/styles.ts'
import { createTerminal } from './lib/terminal.ts'
import {
  ansi as exportedAnsi,
  createStyles as exportedCreateStyles,
  createTerminal as exportedCreateTerminal,
  shouldUseColors as exportedShouldUseColors,
  stripAnsi as exportedStripAnsi,
} from './index.ts'

describe('package entrypoint', () => {
  it('exports runtime APIs from their owning modules', () => {
    assert.equal(exportedAnsi, ansi)
    assert.equal(exportedCreateStyles, createStyles)
    assert.equal(exportedCreateTerminal, createTerminal)
    assert.equal(exportedShouldUseColors, shouldUseColors)
    assert.equal(exportedStripAnsi, stripAnsi)
  })
})
