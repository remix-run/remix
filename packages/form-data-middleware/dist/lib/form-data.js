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
    let suppressErrors = options?.suppressErrors ?? false;
    let uploadHandler = options?.uploadHandler;
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
        let contentType = context.headers.get('Content-Type');
        if (contentType == null ||
            (!contentType.startsWith('multipart/') &&
                !contentType.startsWith('application/x-www-form-urlencoded'))) {
            context.set(FormData, new FormData(), { property: 'formData' });
            return next();
        }
        try {
            context.set(FormData, await parseFormData(context.request, options, uploadHandler), {
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
