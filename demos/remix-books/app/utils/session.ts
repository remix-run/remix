import type { User } from '../models/users.ts'

export interface SessionData {
  userId?: string
  sessionId: string
}

// Simple, in-memory session store for demo purposes
let sessions = new Map<string, SessionData>()

export function getSessionId(request: Request): string {
  let cookie = request.headers.get('Cookie')
  if (!cookie) return createSessionId()

  let match = cookie.match(/sessionId=([^;]+)/)
  if (!match) return createSessionId()

  let sessionId = match[1]
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
  headers.set(
    'Set-Cookie',
    `sessionId=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`,
  )
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
