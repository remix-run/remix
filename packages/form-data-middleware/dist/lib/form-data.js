import { FormDataParseError, parseFormData, } from '@remix-run/form-data-parser';
/**
 * Middleware that parses `FormData` from the request body and populates request context.
 *
 * @param options Options for parsing form data
 * @returns A middleware function that parses form data
 */
export function formData(options) {
    let suppressErrors = options?.suppressErrors ?? false;
    let uploadHandler = options?.uploadHandler;
    return async (context) => {
        if (context.has(FormData)) {
            return;
        }
        if (context.method === 'GET' || context.method === 'HEAD') {
            return;
        }
        let contentType = context.headers.get('Content-Type');
        if (contentType == null ||
            (!contentType.startsWith('multipart/') &&
                !contentType.startsWith('application/x-www-form-urlencoded'))) {
            context.set(FormData, new FormData());
            return;
        }
        try {
            context.set(FormData, await parseFormData(context.request, options, uploadHandler));
        }
        catch (error) {
            if (!suppressErrors || !(error instanceof FormDataParseError)) {
                throw error;
            }
            context.set(FormData, new FormData());
        }
    };
}
