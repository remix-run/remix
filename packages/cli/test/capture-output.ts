import * as process from 'node:process'

export async function captureOutput(
  callback: () => Promise<number>,
  { stderrTTY = false, stdoutTTY = false } = {},
): Promise<{ exitCode: number; stderr: string; stdout: string }> {
  let stderr = ''
  let stdout = ''
  let originalStdoutWrite = process.stdout.write
  let originalStderrWrite = process.stderr.write
  let originalStdoutTTY = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY')
  let originalStderrTTY = Object.getOwnPropertyDescriptor(process.stderr, 'isTTY')

  Object.defineProperty(process.stdout, 'isTTY', {
    configurable: true,
    value: stdoutTTY,
  })

  Object.defineProperty(process.stderr, 'isTTY', {
    configurable: true,
    value: stderrTTY,
  })

  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdout += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8')
    return true
  }) as typeof process.stdout.write

  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderr += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8')
    return true
  }) as typeof process.stderr.write

  try {
    let exitCode = await callback()
    return { exitCode, stderr, stdout }
  } finally {
    process.stdout.write = originalStdoutWrite
    process.stderr.write = originalStderrWrite
    restoreTTY(process.stdout, originalStdoutTTY)
    restoreTTY(process.stderr, originalStderrTTY)
  }
}

function restoreTTY(stream: NodeJS.WriteStream, descriptor: PropertyDescriptor | undefined): void {
  if (descriptor == null) {
    delete (stream as { isTTY?: boolean }).isTTY
    return
  }

  Object.defineProperty(stream, 'isTTY', descriptor)
}
