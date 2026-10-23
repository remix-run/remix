import { ContentType } from '@remix-run/headers/content-type';
import { MaxFilesExceededError, MaxFileSizeExceededError, MaxHeaderSizeExceededError, MaxPartsExceededError, MaxTotalSizeExceededError, parseFormData, } from '@remix-run/form-data-parser';
function isMultipartLimitError(error) {
    return (error instanceof MaxFilesExceededError ||
        error instanceof MaxHeaderSizeExceededError ||
        error instanceof MaxFileSizeExceededError ||
        error instanceof MaxPartsExceededError ||
        error instanceof MaxTotalSizeExceededError);
}
/**
 * Middleware that parses `FormData` from the request body and populates request context.
 *
 * @param options Options for parsing form data
 * @returns A middleware function that parses form data
 */
export function formData(options) {
    let uploadHandler = options?.uploadHandler;
    return createFormDataMiddleware(options?.suppressErrors ?? false, (request) => parseFormData(request, options, uploadHandler));
}
// Shared by the stable and future `formData()` middleware, which differ only in how they parse.
export function createFormDataMiddleware(suppressErrors, parse) {
    return async (context, next) => {
        if (context.has(FormData)) {
            let formData = context.get(FormData);
            if (formData != null) {
                context.set(FormData, formData, { property: 'formData' });
            }
            return next();
        }
        if (context.method === 'GET' || context.method === 'HEAD') {
            context.set(FormData, new FormData(), { property: 'formData' });
            return next();
        }
        let mediaType = ContentType.from(context.headers.get('Content-Type')).mediaType?.toLowerCase();
        if (!mediaType?.startsWith('multipart/') && mediaType !== 'application/x-www-form-urlencoded') {
            context.set(FormData, new FormData(), { property: 'formData' });
            return next();
        }
        try {
            context.set(FormData, await parse(context.request), {
                property: 'formData',
            });
        }
        catch (error) {
            if (!suppressErrors || isMultipartLimitError(error)) {
                throw error;
            }
            context.set(FormData, new FormData(), { property: 'formData' });
        }
        return next();
    };
}
