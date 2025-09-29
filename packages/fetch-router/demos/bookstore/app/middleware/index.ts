import { loggerMiddleware } from './logger.ts'
import { corsMiddleware } from './cors.ts'

export const globalMiddleware = [loggerMiddleware, corsMiddleware]
