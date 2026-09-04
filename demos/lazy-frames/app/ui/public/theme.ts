export type Theme = 'light' | 'dark'

export const themeCookieName = 'lazy-frames-theme'
export const themeCookieMaxAge = 60 * 60 * 24 * 365

export function isTheme(value: string | null): value is Theme {
  return value === 'light' || value === 'dark'
}
