import { FormDataParseError, parseFormData } from '@remix-run/form-data-parser'
import type {
  ParseFormDataOptions,
  FileUpload,
  FileUploadHandler,
} from '@remix-run/form-data-parser'

import type { Middleware } from '../middleware.ts'

export interface FormDataOptions extends ParseFormDataOptions {
  /**
   * Set `true` to suppress parse errors that may arise when parsing invalid form data.
   */
  suppressParseErrors?: boolean
  /**
   * A function that handles file uploads. It receives a `FileUpload` object and may return any
   * value that is valid as a `FormData` value.
   */
  uploadHandler?: FileUploadHandler
}

export type { FileUpload, FileUploadHandler }

/**
 * Middleware that parses `FormData` objects from the request body.
 *
 * This middleware populates `context.formData` and `context.files` with the parsed `FormData`
 * object and uploaded files.
 *
 * @param options (optional) Options for the parser
 * @param uploadHandler (optional) A function that handles file uploads. It receives a `File` object and may return any value that is valid in a `FormData` object
 * @returns A `Middleware` that parses `FormData` objects from the request body
 */
export function formData(options?: FormDataOptions): Middleware {
  let { uploadHandler, ...parserOptions } = options ?? {}

  return async ({ request, formData }, next) => {
    if (formData == null) {
      try {
        let parsed = await parseFormData(request, parserOptions, uploadHandler)

        let files: Record<string, File> = {}
        for (let [key, value] of parsed.entries()) {
          if (value instanceof File) {
            files[key] = value
          }
        }

        return next({ formData: parsed, files })
      } catch (error) {
        if (!(error instanceof FormDataParseError) || !options?.suppressParseErrors) {
          throw error
        }
      }
    }
  }
}
