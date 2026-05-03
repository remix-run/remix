import * as process from 'node:process'
import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { formatHelpText } from './help-text.ts'
import { configureColors } from './terminal.ts'

const ANSI_CSI = `${String.fromCharCode(27)}[`

describe('help text', () => {
  it('renders plain help text with stable section order and alignment', () => {
    let output = withEnv('NO_COLOR', '1', () =>
      withTTY(process.stdout, true, () =>
        formatHelpText(
          {
            description: 'Run the demo command.',
            examples: ['remix demo --json'],
            options: [
              { description: 'Print JSON output', label: '--json' },
              { description: 'Use a custom directory', label: '--dir <path>' },
            ],
            usage: ['remix demo [options]'],
          },
          process.stdout,
        ),
      ),
    )

    assert.equal(
      output,
      [
        'Usage:',
        '  remix demo [options]',
        '',
        'Run the demo command.',
        '',
        'Options:',
        '  --json        Print JSON output',
        '  --dir <path>  Use a custom directory',
        '',
        'Examples:',
        '  remix demo --json',
        '',
      ].join('\n'),
    )
  })

  it('colors headings and syntax tokens when ansi is enabled', () => {
    let output = withEnv('NO_COLOR', undefined, () =>
      withEnv('FORCE_COLOR', '1', () =>
        withEnv('TERM', 'xterm-256color', () =>
          withTTY(process.stdout, true, () => {
            configureColors({ disabled: false })

            return formatHelpText(
              {
                examples: ['remix demo --json'],
                options: [{ description: 'Print JSON output', label: '--dir <path>' }],
                usage: ['remix demo [options]'],
              },
              process.stdout,
            )
          }),
        ),
      ),
    )

    assert.ok(output.includes(`${ANSI_CSI}1m${ANSI_CSI}94mUsage${ANSI_CSI}0m:`))
    assert.ok(output.includes(`remix demo ${ANSI_CSI}93m[options]${ANSI_CSI}0m`))
    assert.ok(output.includes(`${ANSI_CSI}93m--dir${ANSI_CSI}0m ${ANSI_CSI}93m<path>${ANSI_CSI}0m`))
    assert.ok(output.includes(`remix demo ${ANSI_CSI}93m--json${ANSI_CSI}0m`))
  })

  it('colors help for stderr independently of stdout capability', () => {
    let output = withEnv('NO_COLOR', undefined, () =>
      withEnv('FORCE_COLOR', '1', () =>
        withEnv('TERM', 'xterm-256color', () =>
          withTTY(process.stdout, false, () =>
            withTTY(process.stderr, true, () => {
              configureColors({ disabled: false })

              return formatHelpText(
                {
                  usage: ['remix demo <path>'],
                },
                process.stderr,
              )
            }),
          ),
        ),
      ),
    )

    assert.ok(output.includes(`${ANSI_CSI}1m${ANSI_CSI}94mUsage${ANSI_CSI}0m:`))
    assert.ok(output.includes(`remix demo ${ANSI_CSI}93m<path>${ANSI_CSI}0m`))
  })
})

function withEnv<T>(name: string, value: string | undefined, callback: () => T): T {
  let previousValue = process.env[name]

  if (value == null) {
    delete process.env[name]
  } else {
    process.env[name] = value
  }

  try {
    return callback()
  } finally {
    if (previousValue == null) {
      delete process.env[name]
    } else {
      process.env[name] = previousValue
    }

    configureColors({ disabled: false })
  }
}

function withTTY<T>(stream: NodeJS.WriteStream, isTTY: boolean, callback: () => T): T {
  let previous = Object.getOwnPropertyDescriptor(stream, 'isTTY')
  Object.defineProperty(stream, 'isTTY', {
    configurable: true,
    value: isTTY,
  })

  try {
    return callback()
  } finally {
    if (previous == null) {
      delete (stream as { isTTY?: boolean }).isTTY
    } else {
      Object.defineProperty(stream, 'isTTY', previous)
    }
  }
}
