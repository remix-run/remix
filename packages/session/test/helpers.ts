import { SetCookie } from '@remix-run/headers'

// Create a new request using the cookie from the given response
export function createRequest(fromResponse?: Response): Request {
  let headers = new Headers()

  if (fromResponse) {
    let setCookie = fromResponse.headers.getSetCookie()
    if (setCookie && setCookie.length > 0) {
      let header = new SetCookie(setCookie[0])
      headers.append('Cookie', `${header.name}=${header.value}`)
    }
  }

  return new Request('https://remix.run', { headers })
}
