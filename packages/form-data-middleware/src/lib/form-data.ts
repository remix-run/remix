import {
  MaxFilesExceededError,
  MaxFileSizeExceededError,
  MaxHeaderSizeExceededError,
  MaxPartsExceededError,
  MaxTotalSizeExceededError,
  parseFormData,
  type FileUploadHandler,
  type ParseFormDataOptions,
} from '@remix-run/form-data-parser'
import type { Middleware } from '@remix-run/fetch-router'

function isMultipartLimitError(error: unknown): boolean {
  return (
    error instanceof MaxFilesExceededError ||
    error instanceof MaxHeaderSizeExceededError ||
    error instanceof MaxFileSizeExceededError ||
    error instanceof MaxPartsExceededError ||
    error instanceof MaxTotalSizeExceededError
  )
}

/**
 * Options for the {@link formData} middleware.
 */
export interface FormDataOptions extends ParseFormDataOptions {
  /**
   * Set `true` to suppress malformed form-data parse errors. Multipart limit violations always
   * surface as errors even when suppression is enabled.
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
 * Middleware that parses `FormData` from the request body and populates request context.
 *
 * @param options Options for parsing form data
 * @returns A middleware function that parses form data
 */
export function formData(
  options?: FormDataOptions,
): Middleware<{ key: typeof FormData; value: FormData; property: 'formData' }> {
  let suppressErrors = options?.suppressErrors ?? false
  let uploadHandler = options?.uploadHandler

  return async (context, next) => {
    if (context.has(FormData)) {
      let formData = context.get(FormData)
      if (formData != null) {
        context.set(FormData, formData, { property: 'formData' })
      }

      return next()
    }

    if (context.method === 'GET' || context.method === 'HEAD') {
      context.set(FormData, new FormData(), { property: 'formData' })
      return next()
    }

    let contentType = context.headers.get('Content-Type')
    if (
      contentType == null ||
      (!contentType.startsWith('multipart/') &&
        !contentType.startsWith('application/x-www-form-urlencoded'))
    ) {
      context.set(FormData, new FormData(), { property: 'formData' })
      return next()
    }

    try {
      context.set(FormData, await parseFormData(context.request, options, uploadHandler), {
        property: 'formData',
      })
    } catch (error) {
      if (!suppressErrors || isMultipartLimitError(error)) {
        throw error
      }

      context.set(FormData, new FormData(), { property: 'formData' })
    }

    return next()
  }
}
