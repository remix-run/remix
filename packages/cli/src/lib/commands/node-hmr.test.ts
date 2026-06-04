import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { runRemix } from '../../index.ts'
import { captureOutput } from '../../../test/capture-output.ts'
import { getNodeHmrCommandHelpText } from './node-hmr.ts'

const NODE_HMR_COMMAND_HELP_TEXT = await getNodeHmrCommandHelpText()

describe('node-hmr command', () => {
  it('prints node-hmr command help', async () => {
    let result = await captureOutput(() => runRemix(['node-hmr', '--help']))

    assert.equal(result.exitCode, 0)
    assert.equal(result.stdout, `${NODE_HMR_COMMAND_HELP_TEXT}\n`)
    assert.equal(result.stderr, '')
  })

  it('reports node-hmr usage when no entry is provided', async () => {
    let result = await captureOutput(() => runRemix(['node-hmr']))

    assert.equal(result.exitCode, 1)
    assert.equal(result.stdout, '')
    assert.equal(result.stderr, 'Usage: remix node-hmr <entry> [...args]\n')
  })
})
