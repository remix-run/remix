import type { ErrorHandler } from './fetch-handler.ts'

// "Internal Server Error"
const internalServerErrorBody = [
  73, 110, 116, 101, 114, 110, 97, 108, 32, 83, 101, 114, 118, 101, 114, 32, 69, 114, 114, 111, 114,
]

export async function createErrorResponse(
  onError: ErrorHandler,
  error: unknown,
): Promise<Response> {
  try {
    return (await onError(error)) ?? internalServerError()
  } catch (error) {
    console.error(`There was an error in the error handler: ${error}`)
    return internalServerError()
  }
}

export function defaultErrorHandler(error: unknown): Response {
  console.error(error)
  return internalServerError()
}

function internalServerError(): Response {
  return new Response(new Uint8Array(internalServerErrorBody), {
    status: 500,
    headers: {
      'Content-Type': 'text/plain',
    },
  })
}
