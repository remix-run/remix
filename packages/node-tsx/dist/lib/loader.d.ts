import type { registerHooks } from 'node:module';
type RegisterHooksOptions = Parameters<typeof registerHooks>[0];
export declare function initialize(data?: {
    namespace?: string;
}): void;
/**
 * Transforms `.ts`, `.tsx`, and `.jsx` modules into runnable JavaScript for Node's `load` hook API.
 *
 * @param url Module URL being loaded by Node.
 * @param context Hook context for the current load request.
 * @param nextLoad Continuation for delegating to the next registered hook.
 * @returns The transformed module source for supported TypeScript/JSX files, or the delegated result.
 */
export declare const load: NonNullable<RegisterHooksOptions['load']>;
export declare const resolve: NonNullable<RegisterHooksOptions['resolve']>;
export declare function createLoadModuleSpecifier(specifier: string, parentURL: string, namespace: string): string;
export {};
//# sourceMappingURL=loader.d.ts.map