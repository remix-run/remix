import * as assert from 'node:assert/strict'
import * as process from 'node:process'
import { describe, it } from 'node:test'

import {
  bold,
  clearCurrentLine,
  configureColors,
  lightBlue,
  lightGreen,
  lightMagenta,
  lightRed,
  remixWordmark,
  reset,
  restoreTerminalFormatting,
} from './terminal.ts'

describe('terminal', () => {
  it('styles stdout when stdout is a tty', async () => {
    withEnv('NO_COLOR', undefined, () =>
      withEnv('TERM', 'xterm-256color', () =>
        withTTY(process.stdout, true, () => {
          configureColors({ disabled: false })

          assert.equal(bold('ok'), '\u001B[1mok\u001B[0m')
          assert.equal(lightBlue('hi'), '\u001B[94mhi\u001B[0m')
          assert.equal(lightGreen('yes'), '\u001B[92myes\u001B[0m')
          assert.equal(lightMagenta('wow'), '\u001B[95mwow\u001B[0m')
          assert.equal(reset(process.stdout), '\u001B[0m')
        }),
      ),
    )
  })

  it('colors stderr when stderr is a tty', async () => {
    withEnv('NO_COLOR', undefined, () =>
      withEnv('TERM', 'xterm-256color', () =>
        withTTY(process.stderr, true, () => {
          configureColors({ disabled: false })

          assert.equal(lightRed('nope', process.stderr), '\u001B[91mnope\u001B[0m')
          assert.equal(reset(process.stderr), '\u001B[0m')
        }),
      ),
    )
  })

  it('does not color when stdout is not a tty', async () => {
    withEnv('NO_COLOR', undefined, () =>
      withEnv('TERM', 'xterm-256color', () =>
        withTTY(process.stdout, false, () => {
          configureColors({ disabled: false })

          assert.equal(bold('ok'), 'ok')
          assert.equal(reset(process.stdout), '')
        }),
      ),
    )
  })

  it('does not color when stderr is not a tty', async () => {
    withEnv('NO_COLOR', undefined, () =>
      withEnv('TERM', 'xterm-256color', () =>
        withTTY(process.stderr, false, () => {
          configureColors({ disabled: false })

          assert.equal(lightRed('nope', process.stderr), 'nope')
          assert.equal(reset(process.stderr), '')
        }),
      ),
    )
  })

  it('does not color when NO_COLOR is set', async () => {
    withEnv('NO_COLOR', '1', () =>
      withTTY(process.stdout, true, () => {
        configureColors({ disabled: false })

        assert.equal(bold('ok'), 'ok')
        assert.equal(reset(process.stdout), '')
      }),
    )
  })

  it('does not color when TERM is dumb', async () => {
    withEnv('NO_COLOR', undefined, () =>
      withEnv('TERM', 'dumb', () =>
        withTTY(process.stdout, true, () => {
          configureColors({ disabled: false })

          assert.equal(bold('ok'), 'ok')
          assert.equal(remixWordmark(), 'REMIX')
          assert.equal(reset(process.stdout), '')
        }),
      ),
    )
  })

  it('does not color when disabled by a global flag', async () => {
    withEnv('NO_COLOR', undefined, () =>
      withEnv('TERM', 'xterm-256color', () =>
        withTTY(process.stdout, true, () => {
          configureColors({ disabled: true })

          assert.equal(bold('ok'), 'ok')
          assert.equal(reset(process.stdout), '')
        }),
      ),
    )
  })

  it('restores terminal formatting on stdout when stdout supports ansi', async () => {
    withEnv('TERM', 'xterm-256color', () =>
      withTTY(process.stdout, true, () =>
        withCapturedWrites(process.stdout, (writes) => {
          configureColors({ disabled: true })

          restoreTerminalFormatting()

          assert.deepEqual(writes, ['\u001B[0m'])
        }),
      ),
    )
  })

  it('restores terminal formatting on stderr when only stderr supports ansi', async () => {
    withEnv('TERM', 'xterm-256color', () =>
      withTTY(process.stdout, false, () =>
        withTTY(process.stderr, true, () =>
          withCapturedWrites(process.stderr, (writes) => {
            configureColors({ disabled: false })

            restoreTerminalFormatting()

            assert.deepEqual(writes, ['\u001B[0m'])
          }),
        ),
      ),
    )
  })

  it('does not restore terminal formatting when ansi is unavailable', async () => {
    withEnv('TERM', 'dumb', () =>
      withTTY(process.stdout, true, () =>
        withCapturedWrites(process.stdout, (writes) => {
          restoreTerminalFormatting()

          assert.deepEqual(writes, [])
        }),
      ),
    )
  })

  it('renders the Remix wordmark with one color per letter when colors are enabled', async () => {
    withEnv('NO_COLOR', undefined, () =>
      withEnv('TERM', 'xterm-256color', () =>
        withTTY(process.stdout, true, () => {
          configureColors({ disabled: false })

          assert.equal(
            remixWordmark(),
            '\u001B[94mR\u001B[0m\u001B[92mE\u001B[0m\u001B[93mM\u001B[0m\u001B[95mI\u001B[0m\u001B[91mX\u001B[0m',
          )
        }),
      ),
    )
  })

  it('renders the Remix wordmark without color when colors are disabled', async () => {
    withEnv('NO_COLOR', '1', () =>
      withTTY(process.stdout, true, () => {
        configureColors({ disabled: false })

        assert.equal(remixWordmark(), 'REMIX')
      }),
    )
  })

  it('returns the ansi sequence to clear the current line', async () => {
    assert.equal(clearCurrentLine(), '\r\u001B[2K')
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

function withCapturedWrites<T>(stream: NodeJS.WriteStream, callback: (writes: string[]) => T): T {
  let writes: string[] = []
  let originalWrite = stream.write.bind(stream)

  stream.write = ((chunk: string | Uint8Array) => {
    writes.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'))
    return true
  }) as typeof stream.write

  try {
    return callback(writes)
  } finally {
    stream.write = originalWrite
  }
}
