export function wantsJson(request: Request) {
  let accept = request.headers.get('Accept') ?? ''
  return accept.includes('application/json') && !accept.includes('text/html')
}
