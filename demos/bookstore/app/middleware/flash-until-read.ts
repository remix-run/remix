import type { Middleware } from 'remix/router'
import { Session } from 'remix/session'

export class FlashUntilRead {
  #session: Session

  constructor(session: Session) {
    this.#session = session
  }

  set(key: string, value: unknown): void {
    this.#session.set(`flashUntilRead:${key}`, value)
  }

  get(key: string): unknown {
    let sessionKey = `flashUntilRead:${key}`
    let value = this.#session.get(sessionKey)
    if (value === undefined) return undefined

    // Unlike session.flash(), unrelated requests leave the value available for its reader.
    this.#session.unset(sessionKey)
    return value
  }
}

export function flashUntilRead(): Middleware<{
  key: typeof FlashUntilRead
  value: FlashUntilRead
  property: 'flashUntilRead'
}> {
  return (context, next) => {
    let session = context.get(Session)
    if (session == null) {
      throw new Error('Expected session() middleware before flashUntilRead()')
    }

    context.set(FlashUntilRead, new FlashUntilRead(session), { property: 'flashUntilRead' })
    return next()
  }
}
