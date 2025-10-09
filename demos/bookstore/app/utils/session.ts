import { Cookie, SetCookie } from '@remix-run/headers'

import type { User } from '../models/users.ts'

export interface SessionData {
  userId?: string
  sessionId: string
}

// Simple, in-memory session store for demo purposes
const sessions = new Map<string, SessionData>()

export function getSessionId(request: Request): string {
  let cookieHeader = request.headers.get('Cookie')
  if (!cookieHeader) return createSessionId()

  let cookie = new Cookie(cookieHeader)
  let sessionId = cookie.get('sessionId')

  if (!sessionId) return createSessionId()

  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { sessionId })
  }

  return sessionId
}

export function createSessionId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

export function getSession(request: Request): SessionData {
  let sessionId = getSessionId(request)
  let session = sessions.get(sessionId)

  if (!session) {
    session = { sessionId }
    sessions.set(sessionId, session)
  }

  return session
}

export function setSessionCookie(headers: Headers, sessionId: string): void {
  let cookie = new SetCookie({
    name: 'sessionId',
    value: sessionId,
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
    maxAge: 2592000, // 30 days
  })

  headers.set('Set-Cookie', cookie.toString())
}

export function login(sessionId: string, user: User): void {
  let session = sessions.get(sessionId)
  if (!session) {
    session = { sessionId }
    sessions.set(sessionId, session)
  }
  session.userId = user.id
}

export function logout(sessionId: string): void {
  let session = sessions.get(sessionId)
  if (session) {
    delete session.userId
  }
}

export function getUserIdFromSession(sessionId: string): string | undefined {
  let session = sessions.get(sessionId)
  return session?.userId
}
