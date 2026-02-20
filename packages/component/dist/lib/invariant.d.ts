/**
 * Use this when framework code is incorrect, indicating an internal bug rather
 * than application code error.
 *
 * @param assertion The value to check for truthiness
 * @param message Optional message to include in the error
 */
export declare function invariant(assertion: any, message?: string): asserts assertion;
/**
 * Use this when application logic is incorrect, indicating a developer error.
 *
 * Using ID-based warnings with external documentation links allows us to:
 * - Update warning messages without releasing new versions
 * - Avoid bloating the library with warning messages or complicating builds
 *   with prod/dev build/export shenanigans
 * - Provide detailed troubleshooting guides and examples
 *
 * `id` is first so we can easily grep the codebase for ensure calls
 *
 * @param id The error ID for the documentation link
 * @param assertion The value to check for truthiness
 */
export declare function ensure(id: number, assertion: boolean): asserts assertion;
