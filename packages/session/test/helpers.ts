import { SetCookie } from '@remix-run/headers'

// Create a new request using the cookie in the given response
export function createRequest(fromResponse?: Response): Request {
  let headers = new Headers()
  if (fromResponse) {
    let setCookie = fromResponse.headers.getSetCookie()
    if (setCookie.length > 0) {
      let cookie = new SetCookie(setCookie[0])
      headers.append('Cookie', `${cookie.name}=${cookie.value}`)
    }
  }
  return new Request('https://remix.run', { headers })
}
