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

type SetFormDataContextTransform = readonly [readonly [typeof FormData, FormData]]

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
): Middleware<any, any, SetFormDataContextTransform> {
  let suppressErrors = options?.suppressErrors ?? false
  let uploadHandler = options?.uploadHandler

  return async (context) => {
    if (context.has(FormData)) {
      return
    }

    if (context.method === 'GET' || context.method === 'HEAD') {
      return
    }

    let contentType = context.headers.get('Content-Type')
    if (
      contentType == null ||
      (!contentType.startsWith('multipart/') &&
        !contentType.startsWith('application/x-www-form-urlencoded'))
    ) {
      context.set(FormData, new FormData())
      return
    }

    try {
      context.set(FormData, await parseFormData(context.request, options, uploadHandler))
    } catch (error) {
      if (!suppressErrors || isMultipartLimitError(error)) {
        throw error
      }

      context.set(FormData, new FormData())
    }
  }
}
