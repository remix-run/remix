export type RequestBodyMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS'

/**
 * All HTTP request methods for requests that may have a body.
 */
export const RequestBodyMethods = ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const

/**
 * All HTTP request methods supported by the router.
 */
export type RequestMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS'

/**
 * All HTTP request methods that are supported by the router.
 */
export const RequestMethods = ['GET', 'HEAD', ...RequestBodyMethods] as const

const requestMethods = new Set<string>(RequestMethods)

/**
 * Check if a string is one of the request methods supported by the router.
 *
 * @param method The request method to check
 * @returns `true` if the method is supported by the router
 */
export function isRequestMethod(method: string): method is RequestMethod {
  return requestMethods.has(method)
}
