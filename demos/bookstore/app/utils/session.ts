import type { User } from '../models/users.ts'
import type { Session } from '@remix-run/session'

declare module '@remix-run/session' {
  interface SessionData {
    cartId?: string
    userId?: string
  }
}

export function login(session: Session, user: User): void {
  session.set('userId', user.id)
}

export function logout(session: Session): void {
  session.destroy()
}

export function getUserIdFromSession(session: Session): string | undefined {
  return session.get('userId')
}
