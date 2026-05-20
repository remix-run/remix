import { isRequestMethod } from '@remix-run/fetch-router';
/**
 * Middleware that overrides `context.method` with the value of the method override field.
 *
 * Note: This middleware must be placed after the
 * {@link import('@remix-run/form-data-middleware').formData} middleware in the middleware
 * chain, or some other middleware that provides `context.get(FormData)`.
 *
 * @param options Options for the method override middleware
 * @returns A middleware that overrides `context.method` with the value of the method override field
 */
export function methodOverride(options) {
    let fieldName = options?.fieldName ?? '_method';
    return (context) => {
        let method = context.get(FormData)?.get(fieldName);
        if (typeof method !== 'string') {
            return;
        }
        let requestMethod = method.toUpperCase();
        if (isRequestMethod(requestMethod)) {
            context.method = requestMethod;
        }
    };
}
