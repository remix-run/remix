export type RequestBodyMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';
/**
 * All HTTP request methods for requests that may have a body.
 */
export declare const RequestBodyMethods: readonly ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"];
/**
 * All HTTP request methods supported by the router.
 */
export type RequestMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';
/**
 * All HTTP request methods that are supported by the router.
 */
export declare const RequestMethods: readonly ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];
/**
 * Check if a string is one of the request methods supported by the router.
 *
 * @param method The request method to check
 * @returns `true` if the method is supported by the router
 */
export declare function isRequestMethod(method: string): method is RequestMethod;
//# sourceMappingURL=request-methods.d.ts.map