import {
  FormDataParseError,
  parseFormData,
  type FileUploadHandler,
  type ParseFormDataOptions,
} from '@remix-run/form-data-parser'
import type { Middleware } from '@remix-run/fetch-router'

/**
 * Options for the `formData` middleware.
 */
export interface FormDataOptions extends ParseFormDataOptions {
  /**
   * Set `true` to suppress parse errors.
   *
   * @default false
   */
  suppressErrors?: boolean
  /**
   * A function that handles file uploads. It receives a `FileUpload` object and may return any
   * value that is a valid `FormData` value. Default is `undefined`, which means file uploads are
   * stored in memory.
   */
  uploadHandler?: FileUploadHandler
}

/**
 * Middleware that parses `FormData` from the request body and populates `context.formData`.
 *
 * @param options Options for parsing form data
 * @returns A middleware function that parses form data
 */
export function formData(options?: FormDataOptions): Middleware {
  let suppressErrors = options?.suppressErrors ?? false
  let uploadHandler = options?.uploadHandler

  return async (context) => {
    if (context.method === 'GET' || context.method === 'HEAD') {
      return
    }

    let contentType = context.headers.get('Content-Type')
    if (
      contentType == null ||
      (!contentType.startsWith('multipart/') &&
        !contentType.startsWith('application/x-www-form-urlencoded'))
    ) {
      context.formData = new FormData()
      return
    }

    try {
      context.formData = await parseFormData(context.request, options, uploadHandler)
    } catch (error) {
      if (!suppressErrors || !(error instanceof FormDataParseError)) {
        throw error
      }

      context.formData = new FormData()
    }
  }
}
