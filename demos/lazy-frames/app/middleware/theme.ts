import { createCookie } from 'remix/cookie'
import { createContextKey, type Middleware } from 'remix/router'

import { isTheme, themeCookieMaxAge, themeCookieName, type Theme } from '../ui/public/theme.ts'

export const themeContext = createContextKey<Theme>()

const themeCookie = createCookie(themeCookieName, {
  decode: (value) => value,
  encode: (value) => value,
  maxAge: themeCookieMaxAge,
  path: '/',
  sameSite: 'Lax',
})

export function loadTheme(): Middleware<{ key: typeof themeContext; value: Theme }> {
  return async (context, next) => {
    let value = await themeCookie.parse(context.headers.get('Cookie'))
    context.set(themeContext, isTheme(value) ? value : 'light')
    return next()
  }
}
