import { type FileUploadHandler, type ParseFormDataOptions } from '@remix-run/form-data-parser';
import type { ContextEntry, Middleware } from '@remix-run/fetch-router';
type FormDataContextEntry = ContextEntry<typeof FormData, FormData>;
/**
 * Options for the {@link formData} middleware.
 */
export interface FormDataOptions extends ParseFormDataOptions {
    /**
     * Set `true` to suppress malformed form-data parse errors. Multipart limit violations always
     * surface as errors even when suppression is enabled.
     *
     * @default false
     */
    suppressErrors?: boolean;
    /**
     * A function that handles file uploads. It receives a `FileUpload` object and may return any
     * value that is a valid `FormData` value. Default is `undefined`, which means file uploads are
     * stored in memory.
     */
    uploadHandler?: FileUploadHandler;
}
/**
 * Middleware that parses `FormData` from the request body and populates request context.
 *
 * @param options Options for parsing form data
 * @returns A middleware function that parses form data
 */
export declare function formData(options?: FormDataOptions): Middleware<FormDataContextEntry>;
export {};
//# sourceMappingURL=form-data.d.ts.map