export function resolveFileTimeout(value: number | string = 600_000): number {
  let milliseconds = Number(value)
  if (
    (typeof value === 'string' && value.trim() === '') ||
    !Number.isInteger(milliseconds) ||
    milliseconds < 0 ||
    milliseconds > 2_147_483_647
  ) {
    throw new Error(
      `Invalid fileTimeout value "${value}". Expected an integer from 0 to 2147483647`,
    )
  }
  return milliseconds
}

export async function withFileTimeout<result>(
  file: string,
  environment: string,
  milliseconds: number,
  task: (signal: AbortSignal) => Promise<result>,
): Promise<result> {
  let controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let deadline = new Promise<never>((_, reject) => {
    if (milliseconds === 0) return
    timer = setTimeout(() => {
      let error = new Error(
        `Test file ${file} [${environment}] exceeded its ${milliseconds}ms deadline`,
      )
      reject(error)
      controller.abort(error)
    }, milliseconds)
  })
  try {
    return await Promise.race([task(controller.signal), deadline])
  } finally {
    clearTimeout(timer)
  }
}
