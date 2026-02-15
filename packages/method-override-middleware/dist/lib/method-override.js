import { RequestMethods } from '@remix-run/fetch-router';
/**
 * Middleware that overrides `context.method` with the value of the method override field.
 *
 * Note: This middleware must be placed after the `formData` middleware in the middleware chain, or
 * some other middleware that provides `context.formData`.
 *
 * @param options Options for the method override middleware
 * @returns A middleware that overrides `context.method` with the value of the method override field
 */
export function methodOverride(options) {
    let fieldName = options?.fieldName ?? '_method';
    return (context) => {
        let method = context.formData?.get(fieldName);
        if (typeof method !== 'string') {
            return;
        }
        let requestMethod = method.toUpperCase();
        if (RequestMethods.includes(requestMethod)) {
            context.method = requestMethod;
        }
    };
}
