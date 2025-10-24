import type { User } from '../models/users.ts'
import type { Session } from '@remix-run/session'

export interface SessionData {
  userId?: string
  sessionId: string
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
