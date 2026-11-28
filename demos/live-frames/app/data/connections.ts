let connections = 0
const drops = new Set<() => void>()

/** Counts a stream request, so a board can show which connection is feeding it. */
export function countConnection(): number {
  connections += 1
  return connections
}

/**
 * Registers a stream to be hung up on when the demo drops its connections.
 *
 * @param drop Called to end that stream.
 * @returns A function that unregisters the stream.
 */
export function onDrop(drop: () => void): () => void {
  drops.add(drop)
  return () => drops.delete(drop)
}

/** Hangs up every open stream, so the browser has to reconnect. */
export function dropConnections(): void {
  for (let drop of [...drops]) drop()
}
