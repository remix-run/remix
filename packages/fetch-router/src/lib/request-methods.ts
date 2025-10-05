export const RequestMethods = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const

export type RequestMethod = (typeof RequestMethods)[number]
