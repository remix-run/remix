import { parseFormData, } from '@remix-run/form-data-parser/future';
import { createFormDataMiddleware } from '../form-data.js';
/**
 * Middleware that parses `FormData` from the request body and populates request context, streaming
 * file uploads to the `uploadHandler` as they arrive.
 *
 * @param options Options for parsing form data
 * @returns A middleware function that parses form data
 */
export function formData(options) {
    let uploadHandler = options?.uploadHandler;
    return createFormDataMiddleware(options?.suppressErrors ?? false, (request) => parseFormData(request, options, uploadHandler));
}
