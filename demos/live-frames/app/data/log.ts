export type LogLine = {
  id: number
  at: string
  text: string
}

const ENTRIES = [
  'RMX 101 cleared for platform 1',
  'Gate crew signed in at Old Quarry',
  'Track circuit reset between Saltmarsh and Beacon Hill',
  'RMX 422 holding for a late connection',
  'Catering loaded on RMX 530',
  'Signal box handover complete',
  'Platform 3 lift back in service',
]

let lines: LogLine[] = []
let nextId = 1
const listeners = new Set<(line: LogLine) => void>()
let ticker: ReturnType<typeof setInterval> | undefined

/** Lines written so far, which a joining frame receives as one snapshot. */
export function getLog(): LogLine[] {
  return lines
}

/**
 * Watches the log, which writes a line every couple of seconds while anything is watching.
 *
 * @param listener Called with each new line.
 * @returns A function that stops watching.
 */
export function watchLog(listener: (line: LogLine) => void): () => void {
  listeners.add(listener)
  ticker ??= setInterval(write, 2000)

  return () => {
    listeners.delete(listener)
    if (listeners.size > 0 || !ticker) return
    clearInterval(ticker)
    ticker = undefined
  }
}

function write(): void {
  let line: LogLine = {
    id: nextId++,
    at: new Date().toLocaleTimeString('en-GB'),
    text: ENTRIES[Math.floor(Math.random() * ENTRIES.length)]!,
  }

  // The snapshot a joining frame receives stays small; the stream carries the rest as appends.
  lines = [...lines, line].slice(-20)
  for (let listener of [...listeners]) listener(line)
}
