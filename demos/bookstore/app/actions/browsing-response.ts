import { SuperHeaders } from 'remix/headers'

export function browsingResponseInit(request: Request): ResponseInit {
  let isFrameGet = request.method === 'GET' && request.headers.get('X-Remix-Frame') === 'true'

  let headers = new SuperHeaders({
    cacheControl: isFrameGet ? { private: true, maxAge: 30 } : { noStore: true },
  })
  if (isFrameGet) {
    headers.vary = ['Cookie', 'X-Remix-Frame', 'X-Remix-Target', 'X-Remix-Top-Frame-Src']
  }

  return { headers }
}
