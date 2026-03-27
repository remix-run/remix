import * as assert from 'node:assert/strict'
import * as process from 'node:process'
import { describe, it } from 'node:test'

import { createProgressReporter, writeProgressCommandHeader } from './progress.ts'
import { setCliRuntimeContext } from './runtime-context.ts'
import { configureColors } from './terminal.ts'

describe('progress', () => {
  it('renders live-updating gray status lines with animated dots on tty stdout', async () => {
    await withEnv('NO_COLOR', undefined, async () =>
      withEnv('TERM', 'xterm-256color', async () =>
        withTTY(process.stdout, true, async () =>
          withCapturedWrites(process.stdout, async (writes) => {
            configureColors({ disabled: false })
            let progress = createProgressReporter(process.stdout, { frameIntervalMs: 5 })

            progress.start('prepare target directory')
            await wait(25)
            progress.succeed()

            assert.equal(writes[0], '\r\u001B[2K\u001B[90m• prepare target directory.\u001B[0m')
            assert.ok(
              writes.some(
                (write) =>
                  write === '\r\u001B[2K\u001B[90m• prepare target directory..\u001B[0m' ||
                  write === '\r\u001B[2K\u001B[90m• prepare target directory...\u001B[0m',
              ),
            )
            assert.equal(
              writes[writes.length - 1],
              '\r\u001B[2K\u001B[92m✓\u001B[0m \u001B[90mprepare target directory\u001B[0m\n',
            )
          }),
        ),
      ),
    )
  })

  it('renders static progress lines when stdout is not a tty', async () => {
    await withEnv('NO_COLOR', undefined, async () =>
      withEnv('TERM', 'xterm-256color', async () =>
        withTTY(process.stdout, false, async () =>
          withCapturedWrites(process.stdout, async (writes) => {
            configureColors({ disabled: false })
            let progress = createProgressReporter(process.stdout)

            progress.start('environment')
            progress.fail()
            progress.skip('controllers', 'Blocked by project-contract warnings.')

            assert.deepEqual(writes, [
              '• environment...\n',
              '✗ environment\n',
              '• controllers (skipped: Blocked by project-contract warnings.)\n',
            ])
          }),
        ),
      ),
    )
  })

  it('suppresses progress colors when ansi is unavailable or disabled', async () => {
    await withEnv('NO_COLOR', '1', async () =>
      withEnv('TERM', 'xterm-256color', async () =>
        withTTY(process.stdout, true, async () =>
          withCapturedWrites(process.stdout, async (writes) => {
            configureColors({ disabled: false })
            let progress = createProgressReporter(process.stdout)

            progress.start('finalize package.json')
            progress.succeed()

            assert.deepEqual(writes, [
              '\r\u001B[2K• finalize package.json.',
              '\r\u001B[2K✓ finalize package.json\n',
            ])
          }),
        ),
      ),
    )
  })

  it('writes a single blank line before the final summary when steps were rendered', async () => {
    await withEnv('NO_COLOR', undefined, async () =>
      withEnv('TERM', 'xterm-256color', async () =>
        withTTY(process.stdout, false, async () =>
          withCapturedWrites(process.stdout, async (writes) => {
            configureColors({ disabled: false })
            let progress = createProgressReporter(process.stdout)

            progress.start('environment')
            progress.succeed()
            progress.writeSummaryGap()
            progress.writeSummaryGap()

            assert.deepEqual(writes, ['• environment...\n', '✓ environment\n', '\n'])
          }),
        ),
      ),
    )
  })

  it('writes an interactive Remix header for progress commands', async () => {
    await withRuntimeContext({ remixVersion: '9.9.9' }, async () =>
      withEnv('NO_COLOR', undefined, async () =>
        withEnv('TERM', 'xterm-256color', async () =>
          withTTY(process.stdout, true, async () =>
            withCapturedWrites(process.stdout, async (writes) => {
              configureColors({ disabled: false })

              await writeProgressCommandHeader('doctor', process.stdout)

              assert.deepEqual(writes, [
                '\u001B[94mR\u001B[0m\u001B[92me\u001B[0m\u001B[93mm\u001B[0m\u001B[95mi\u001B[0m\u001B[91mx\u001B[0m v9.9.9 - doctor\n\n',
              ])
            }),
          ),
        ),
      ),
    )
  })
})

async function withEnv<T>(
  name: string,
  value: string | undefined,
  callback: () => Promise<T> | T,
): Promise<T> {
  let previousValue = process.env[name]

  if (value == null) {
    delete process.env[name]
  } else {
    process.env[name] = value
  }

  try {
    return await callback()
  } finally {
    if (previousValue == null) {
      delete process.env[name]
    } else {
      process.env[name] = previousValue
    }

    configureColors({ disabled: false })
  }
}

async function withTTY<T>(
  stream: NodeJS.WriteStream,
  isTTY: boolean,
  callback: () => Promise<T> | T,
): Promise<T> {
  let previous = Object.getOwnPropertyDescriptor(stream, 'isTTY')
  Object.defineProperty(stream, 'isTTY', {
    configurable: true,
    value: isTTY,
  })

  try {
    return await callback()
  } finally {
    if (previous == null) {
      delete (stream as { isTTY?: boolean }).isTTY
    } else {
      Object.defineProperty(stream, 'isTTY', previous)
    }
  }
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function withCapturedWrites<T>(
  stream: NodeJS.WriteStream,
  callback: (writes: string[]) => Promise<T> | T,
): Promise<T> {
  let writes: string[] = []
  let originalWrite = stream.write.bind(stream)

  stream.write = ((chunk: string | Uint8Array) => {
    writes.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'))
    return true
  }) as typeof stream.write

  try {
    return await callback(writes)
  } finally {
    stream.write = originalWrite
  }
}

async function withRuntimeContext<T>(
  context: { remixVersion?: string },
  callback: () => Promise<T> | T,
): Promise<T> {
  let previousContext = setCliRuntimeContext(context)

  try {
    return await callback()
  } finally {
    setCliRuntimeContext(previousContext)
  }
}
