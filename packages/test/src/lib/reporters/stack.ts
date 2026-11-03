import { normalizeLine } from '../normalize.ts'

export function formatStack(stack: string, frameLimit: number): string[] {
  // The executor separates original error stacks so each failure keeps its source frames.
  return stack.split('\n\n').flatMap((trace, index) => {
    let lines = trace.split('\n')
    let header = index === 0 ? [] : lines.slice(0, 1)
    return [...header, ...lines.slice(1, frameLimit + 1)].map(normalizeLine)
  })
}
