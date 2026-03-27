import * as assert from 'node:assert/strict'
import * as process from 'node:process'
import { describe, it } from 'node:test'

import { bold, configureColors, lightRed, reset, restoreTerminalFormatting } from './color.ts'

describe('color', () => {
  it('styles stdout when stdout is a tty', async () => {
    withEnv('NO_COLOR', undefined, () =>
      withEnv('TERM', 'xterm-256color', () =>
        withTTY(process.stdout, true, () => {
          configureColors({ disabled: false })

          assert.equal(bold('ok'), '\u001B[1mok\u001B[0m')
          assert.equal(reset(), '\u001B[0m')
        }),
      ),
    )
  })

  it('colors stderr when stderr is a tty', async () => {
    withEnv('NO_COLOR', undefined, () =>
      withEnv('TERM', 'xterm-256color', () =>
        withTTY(process.stderr, true, () => {
          configureColors({ disabled: false })

          assert.equal(lightRed('nope', 'stderr'), '\u001B[91mnope\u001B[0m')
          assert.equal(reset('stderr'), '\u001B[0m')
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
          assert.equal(reset(), '')
        }),
      ),
    )
  })

  it('does not color when stderr is not a tty', async () => {
    withEnv('NO_COLOR', undefined, () =>
      withEnv('TERM', 'xterm-256color', () =>
        withTTY(process.stderr, false, () => {
          configureColors({ disabled: false })

          assert.equal(lightRed('nope', 'stderr'), 'nope')
          assert.equal(reset('stderr'), '')
        }),
      ),
    )
  })

  it('does not color when NO_COLOR is set', async () => {
    withEnv('NO_COLOR', '1', () =>
      withTTY(process.stdout, true, () => {
        configureColors({ disabled: false })

        assert.equal(bold('ok'), 'ok')
        assert.equal(reset(), '')
      }),
    )
  })

  it('does not color when TERM is dumb', async () => {
    withEnv('NO_COLOR', undefined, () =>
      withEnv('TERM', 'dumb', () =>
        withTTY(process.stdout, true, () => {
          configureColors({ disabled: false })

          assert.equal(bold('ok'), 'ok')
          assert.equal(reset(), '')
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
          assert.equal(reset(), '')
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

function withCapturedWrites<T>(
  stream: NodeJS.WriteStream,
  callback: (writes: string[]) => T,
): T {
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
