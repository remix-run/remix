import { type FileUploadHandler, type ParseFormDataOptions } from '@remix-run/form-data-parser/future';
import type { Middleware } from '@remix-run/fetch-router';
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
     * A function that handles file uploads. It receives each `FileUpload` as soon as its headers
     * arrive, with its contents streamed from the request, and may return any value that is a valid
     * `FormData` value. Default is `undefined`, which means file uploads are stored in memory.
     */
    uploadHandler?: FileUploadHandler;
}
/**
 * Middleware that parses `FormData` from the request body and populates request context, streaming
 * file uploads to the `uploadHandler` as they arrive.
 *
 * @param options Options for parsing form data
 * @returns A middleware function that parses form data
 */
export declare function formData(options?: FormDataOptions): Middleware<{
    key: typeof FormData;
    value: FormData;
    property: 'formData';
}>;
//# sourceMappingURL=form-data.d.ts.map