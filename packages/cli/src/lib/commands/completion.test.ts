import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { runRemix } from '../../index.ts'
import { captureOutput } from '../../../test/capture-output.ts'

const COMPLETION_COMMAND_HELP_TEXT = [
  'Usage:',
  '  remix completion <bash|zsh>',
  '',
  'Print a shell completion script for Remix.',
  '',
  'Examples:',
  '  remix completion bash >> ~/.bashrc',
  '  remix completion zsh >> ~/.zshrc',
  '',
].join('\n')

const UNKNOWN_COMPLETION_SHELL_ERROR_TEXT = [
  'Error [RMX_UNKNOWN_COMPLETION_SHELL] Unknown completion shell',
  'Unknown completion shell: fish',
  '',
  'Try:',
  '  Run `remix completion bash` or `remix completion zsh`.',
  '',
  COMPLETION_COMMAND_HELP_TEXT,
].join('\n')

describe('completion command', () => {
  it('prints completion command help', async () => {
    let result = await captureOutput(() => runRemix(['completion', '--help']))

    assert.equal(result.exitCode, 0)
    assert.equal(result.stdout, COMPLETION_COMMAND_HELP_TEXT)
    assert.equal(result.stderr, '')
  })

  it('prints completion command help when help appears after the shell', async () => {
    let result = await captureOutput(() => runRemix(['completion', 'bash', '--help']))

    assert.equal(result.exitCode, 0)
    assert.equal(result.stdout, COMPLETION_COMMAND_HELP_TEXT)
    assert.equal(result.stderr, '')
  })

  it('prints the same wrapper for bash and zsh', async () => {
    let bashResult = await captureOutput(() => runRemix(['completion', 'bash']))
    let zshResult = await captureOutput(() => runRemix(['completion', 'zsh']))

    assert.equal(bashResult.exitCode, 0)
    assert.equal(zshResult.exitCode, 0)
    assert.equal(bashResult.stdout, zshResult.stdout)
    assert.match(bashResult.stdout, /complete -o default -F _remix_completion remix/)
    assert.match(bashResult.stdout, /compdef _remix_completion remix/)
    assert.equal(bashResult.stderr, '')
    assert.equal(zshResult.stderr, '')
  })

  it('fails for unsupported shells', async () => {
    let result = await captureOutput(() => runRemix(['completion', 'fish']))

    assert.equal(result.exitCode, 1)
    assert.equal(result.stdout, '')
    assert.equal(result.stderr, UNKNOWN_COMPLETION_SHELL_ERROR_TEXT)
  })

  it('keeps plumbing mode active when completed words include help flags', async () => {
    let result = await captureOutput(() => runRemix(['completion', '--', '2', 'remix', '--help']))

    assert.equal(result.exitCode, 0)
    assert.equal(result.stdout, 'mode:values\n')
    assert.equal(result.stderr, '')
  })

  it('returns machine-readable completions in plumbing mode', async () => {
    let result = await captureOutput(() => runRemix(['completion', '--', '1', 'remix', '']))

    assert.equal(result.exitCode, 0)
    assert.equal(
      result.stdout,
      [
        'mode:values',
        'completion',
        'doctor',
        'help',
        'new',
        'routes',
        'test',
        'version',
        '-h',
        '--help',
        '--no-color',
        '-v',
        '--version',
        '',
      ].join('\n'),
    )
    assert.equal(result.stderr, '')
  })
})
