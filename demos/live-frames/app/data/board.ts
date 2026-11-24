export type Departure = {
  id: string
  service: string
  destination: string
  platform: string
  status: 'On time' | 'Boarding' | 'Delayed'
  departsIn: number
}

const DESTINATIONS = [
  ['RMX 101', 'Harbour Gate'],
  ['RMX 214', 'Old Quarry'],
  ['RMX 318', 'Saltmarsh'],
  ['RMX 422', 'Beacon Hill'],
  ['RMX 530', 'Crescent Bay'],
] as const

let departures: Departure[] = DESTINATIONS.map(([service, destination], index) => ({
  id: service,
  service,
  destination,
  platform: String((index % 4) + 1),
  status: 'On time',
  departsIn: 90 + index * 45,
}))

let listeners = new Set<() => void>()
let ticker: ReturnType<typeof setInterval> | undefined

/** Departures as they stand right now, soonest first. */
export function getDepartures(): Departure[] {
  return [...departures].sort((left, right) => left.departsIn - right.departsIn)
}

/**
 * Watches the board, which ticks once a second while anything is watching.
 *
 * @param listener Called after every tick.
 * @returns A function that stops watching.
 */
export function watchBoard(listener: () => void): () => void {
  listeners.add(listener)
  ticker ??= setInterval(tick, 1000)

  return () => {
    listeners.delete(listener)
    if (listeners.size > 0 || !ticker) return
    clearInterval(ticker)
    ticker = undefined
  }
}

function tick(): void {
  departures = departures.map((departure) => {
    let departsIn = departure.departsIn - 1
    // A departed service rolls back onto the board further down the day.
    if (departsIn < 0) {
      return { ...departure, departsIn: 240 + Math.floor(Math.random() * 180), status: 'On time' }
    }

    let status: Departure['status'] = departure.status
    if (departsIn <= 60) status = 'Boarding'
    else if (departure.status !== 'Delayed' && Math.random() < 0.01) status = 'Delayed'

    return { ...departure, departsIn, status }
  })

  for (let listener of [...listeners]) listener()
}
