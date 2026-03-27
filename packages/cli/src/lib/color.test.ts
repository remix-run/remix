import * as assert from 'node:assert/strict'
import * as process from 'node:process'
import { describe, it } from 'node:test'

import { configureColors, lightGray, lightRed, reset } from './color.ts'

describe('color', () => {
  it('colors stdout when stdout is a tty', async () => {
    withEnv('NO_COLOR', undefined, () =>
      withEnv('TERM', 'xterm-256color', () =>
        withTTY(process.stdout, true, () => {
          configureColors({ disabled: false })

          assert.equal(lightGray('ok'), '\u001B[90mok\u001B[0m')
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

          assert.equal(lightGray('ok'), 'ok')
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

        assert.equal(lightGray('ok'), 'ok')
        assert.equal(reset(), '')
      }),
    )
  })

  it('does not color when TERM is dumb', async () => {
    withEnv('NO_COLOR', undefined, () =>
      withEnv('TERM', 'dumb', () =>
        withTTY(process.stdout, true, () => {
          configureColors({ disabled: false })

          assert.equal(lightGray('ok'), 'ok')
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

          assert.equal(lightGray('ok'), 'ok')
          assert.equal(reset(), '')
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
