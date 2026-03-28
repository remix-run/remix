import * as assert from 'node:assert/strict'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as process from 'node:process'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import { createCommandReporter } from './reporter.ts'
import { setCliRuntimeContext } from './runtime-context.ts'
import { configureColors } from './terminal.ts'

describe('reporter', () => {
  it('renders indented sections, bullets, and labels on stdout', async () => {
    await withCapturedWrites(process.stdout, async (writes) => {
      let reporter = createCommandReporter()

      reporter.out.line('Summary')
      reporter.out.section('Findings:', () => {
        reporter.out.bullet(reporter.out.label('WARN', 'Missing app/routes.ts.'))
        reporter.out.bullet('Created app/controllers/home.tsx')
      })
      reporter.finish()

      assert.deepEqual(writes, [
        '\n',
        'Summary\n',
        'Findings:\n',
        '  • [WARN] Missing app/routes.ts.\n',
        '  • Created app/controllers/home.tsx\n',
        '\n',
      ])
    })
  })

  it('formats labels without writing output on its own', async () => {
    await withCapturedWrites(process.stdout, async (writes) => {
      let reporter = createCommandReporter()
      let labeledText = reporter.out.label('WARN', 'Missing app/routes.ts.')

      assert.equal(labeledText, '[WARN] Missing app/routes.ts.')
      assert.deepEqual(writes, [])
    })
  })

  it('coalesces repeated blank lines on stdout', async () => {
    await withCapturedWrites(process.stdout, async (writes) => {
      let reporter = createCommandReporter()

      reporter.out.line('One')
      reporter.out.blank()
      reporter.out.blank()
      reporter.out.line('Two')
      reporter.finish()

      assert.deepEqual(writes, ['\n', 'One\n', '\n', 'Two\n', '\n'])
    })
  })

  it('renders tables with bold headers and optional omitted headers', async () => {
    await withEnv('NO_COLOR', undefined, async () =>
      withEnv('TERM', 'xterm-256color', async () =>
        withTTY(process.stdout, true, async () =>
          withCapturedWrites(process.stdout, async (writes) => {
            configureColors({ disabled: false })
            let reporter = createCommandReporter()

            reporter.out.table({
              headers: ['Route', 'Method'],
              rows: [
                ['home', 'ANY'],
                ['auth.login.action', 'POST'],
              ],
            })
            reporter.out.blank()
            reporter.out.table({
              headers: ['Route', 'Method'],
              noHeaders: true,
              rows: [['home', 'ANY']],
            })
            reporter.finish()

            assert.deepEqual(writes, [
              '\n',
              '\u001B[1mRoute            \u001B[0m  \u001B[1mMethod\u001B[0m\n',
              'home               ANY   \n',
              'auth.login.action  POST  \n',
              '\n',
              'home   ANY   \n',
              '\n',
            ])
          }),
        ),
      ),
    )
  })

  it('renders progress to stderr with live tty updates', async () => {
    await withEnv('NO_COLOR', undefined, async () =>
      withEnv('TERM', 'xterm-256color', async () =>
        withTTY(process.stderr, true, async () =>
          withCapturedWrites(process.stderr, async (writes) => {
            configureColors({ disabled: false })
            let reporter = createCommandReporter({ statusFrameIntervalMs: 5 })

            reporter.status.startStep('Checking environment')
            await wait(25)
            reporter.status.succeedStep()
            reporter.status.summaryGap()

            assert.equal(writes[0], '\n')
            assert.equal(writes[1], '\r\u001B[2K\u001B[90m• Checking environment.\u001B[0m')
            assert.ok(
              writes.some(
                (write) =>
                  write === '\r\u001B[2K\u001B[90m• Checking environment..\u001B[0m' ||
                  write === '\r\u001B[2K\u001B[90m• Checking environment...\u001B[0m',
              ),
            )
            assert.deepEqual(writes.slice(-2), [
              '\r\u001B[2K\u001B[92m✓\u001B[0m \u001B[90mChecking environment\u001B[0m\n',
              '\n',
            ])
          }),
        ),
      ),
    )
  })

  it('renders non-interactive progress as stable stderr lines', async () => {
    await withEnv('NO_COLOR', undefined, async () =>
      withEnv('TERM', 'xterm-256color', async () =>
        withTTY(process.stderr, false, async () =>
          withCapturedWrites(process.stderr, async (writes) => {
            configureColors({ disabled: false })
            let reporter = createCommandReporter()

            reporter.status.startStep('Checking project')
            reporter.status.failStep()
            reporter.status.skipStep('controllers', 'Blocked by project warnings.')
            reporter.finish()

            assert.deepEqual(writes, [
              '\n',
              '• Checking project...\n',
              '✗ Checking project\n',
              '• controllers (skipped: Blocked by project warnings.)\n',
              '\n',
            ])
          }),
        ),
      ),
    )
  })

  it('writes the progress command header to stderr and never stdout', async () => {
    await withRuntimeContext({ remixVersion: '9.9.9' }, async () =>
      withEnv('NO_COLOR', undefined, async () =>
        withEnv('TERM', 'xterm-256color', async () =>
          withTTY(process.stderr, true, async () =>
            withCapturedWrites(process.stdout, async (stdoutWrites) =>
              withCapturedWrites(process.stderr, async (stderrWrites) => {
                configureColors({ disabled: false })
                let reporter = createCommandReporter()

                await reporter.status.commandHeader('doctor')

                assert.deepEqual(stdoutWrites, [])
                assert.deepEqual(stderrWrites, [
                  '\n',
                  '\u001B[94mR\u001B[0m\u001B[92mE\u001B[0m\u001B[93mM\u001B[0m\u001B[95mI\u001B[0m\u001B[91mX\u001B[0m v9.9.9 - doctor\n\n',
                ])
              }),
            ),
          ),
        ),
      ),
    )
  })

  it('does not add a second preamble when progress is on stderr and the summary is on stdout', async () => {
    await withEnv('NO_COLOR', undefined, async () =>
      withEnv('TERM', 'xterm-256color', async () =>
        withTTY(process.stderr, false, async () =>
          withCapturedWrites(process.stdout, async (stdoutWrites) =>
            withCapturedWrites(process.stderr, async (stderrWrites) => {
              configureColors({ disabled: false })
              let reporter = createCommandReporter()

              reporter.status.startStep('Checking skills')
              reporter.status.succeedStep()
              reporter.status.summaryGap()
              reporter.out.line('Checked Remix skills against .agents/skills: 2 installed.')
              reporter.finish()

              assert.deepEqual(stderrWrites, [
                '\n',
                '• Checking skills...\n',
                '✓ Checking skills\n',
                '\n',
              ])
              assert.deepEqual(stdoutWrites, [
                'Checked Remix skills against .agents/skills: 2 installed.\n',
                '\n',
              ])
            }),
          ),
        ),
      ),
    )
  })

  it('keeps bullet formatting centralized in the reporter', async () => {
    let commandDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'commands')
    let files = ['doctor.ts', 'new.ts', 'routes.ts', 'skills.ts']

    for (let file of files) {
      let source = await fs.readFile(path.join(commandDir, file), 'utf8')
      assert.doesNotMatch(source, /•/)
    }
  })
})

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
