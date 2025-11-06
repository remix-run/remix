export type RequestBodyMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS'

/**
 * All HTTP request methods for requests that may have a body.
 */
export const RequestBodyMethods = ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const

export type RequestMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS'

/**
 * All HTTP request methods that are supported by the router.
 */
export const RequestMethods = ['GET', 'HEAD', ...RequestBodyMethods] as const
