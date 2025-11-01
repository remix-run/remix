import {
  FormDataParseError,
  parseFormData,
  type FileUploadHandler,
  type ParseFormDataOptions,
} from '@remix-run/form-data-parser'

import type { Middleware } from '../middleware.ts'
import type { RequestContext } from '../request-context.ts'
import { RequestBodyMethods, type RequestBodyMethod } from '../request-methods.ts'

export interface FormDataOptions {
  /**
   * Set `true` to suppress parse errors. Default is `false`.
   */
  suppressErrors?: boolean
  /**
   * Options for parsing form data. Default is `{}`.
   */
  parseOptions?: ParseFormDataOptions
  /**
   * A function that handles file uploads. It receives a `FileUpload` object and may return any
   * value that is a valid `FormData` value. Default is `undefined`.
   */
  uploadHandler?: FileUploadHandler
}

/**
 * Middleware that parses `FormData` from the request body and populates `context.formData`.
 * @param options Options for parsing form data
 * @returns A middleware function that parses form data
 */
export function formData(options?: FormDataOptions): Middleware {
  let suppressParseErrors = options?.suppressErrors ?? false
  let parseOptions = options?.parseOptions ?? {}

  return async (context: RequestContext) => {
    if (!canParseFormData(context)) {
      return
    }

    try {
      context.formData = await parseFormData(context.request, parseOptions, options?.uploadHandler)
    } catch (error) {
      if (!suppressParseErrors || !(error instanceof FormDataParseError)) {
        throw error
      }
    }
  }
}

function canParseFormData(context: RequestContext): boolean {
  if (!RequestBodyMethods.includes(context.method as RequestBodyMethod)) {
    return false
  }

  let contentType = context.headers.get('Content-Type')

  return (
    contentType != null &&
    (contentType.startsWith('multipart/') ||
      contentType.startsWith('application/x-www-form-urlencoded'))
  )
}
