import { createStorageKey } from '@remix-run/fetch-router'

export const userKey = createStorageKey<{ id: string; name: string } | null>(null)
export const sessionKey = createStorageKey<string | null>(null)
