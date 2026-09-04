interface NavigationSource {
    sourceElement: Element | undefined;
    formNavigation: FormNavigation | undefined;
}
/** Browser-provided data for an intercepted form submission. */
export interface FormSubmission {
    /** Submitted form entries for non-GET submissions, when available. */
    formData: FormData | undefined;
    /** Effective form method, including submitter overrides. */
    method: string;
    /** Effective form encoding type, including submitter overrides. */
    encType: string;
}
/** Metadata and deferred submission data for an intercepted form navigation. */
export interface FormNavigation {
    /** Checks the submitter before the form for a submission attribute. */
    hasAttribute(name: string): boolean;
    /** Reads a submission attribute, preferring the submitter-specific name when provided. */
    getAttribute(name: string, submitterName?: string): string | null;
    /** Resolves browser-generated data for a non-GET submission. */
    getSubmission: (() => Promise<FormSubmission>) | undefined;
}
/**
 * Tracks native form events and resolves their corresponding Navigation API events.
 *
 * @param signal Signal used to stop tracking form events.
 * @returns A function that resolves form metadata for a navigation event.
 */
export declare function createFormNavigationResolver(signal: AbortSignal): (event: NavigateEvent) => FormNavigation | undefined;
/**
 * Tracks native activation events and resolves their corresponding Navigation API source.
 *
 * @param signal Signal used to stop tracking activation events.
 * @returns A function that resolves source and form metadata for a navigation event.
 */
export declare function createNavigationSourceResolver(signal: AbortSignal): (event: NavigateEvent) => NavigationSource;
export {};
