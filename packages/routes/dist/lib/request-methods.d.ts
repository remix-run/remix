/**
 * HTTP request methods whose requests may carry a body. Mirrors the
 * runtime tuple {@link RequestBodyMethods}.
 */
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
//# sourceMappingURL=request-methods.d.ts.map