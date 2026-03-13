import type { FileStorage } from '@remix-run/file-storage';
export interface S3FileStorageOptions {
    /**
     * AWS access key ID used to sign S3 requests.
     */
    accessKeyId: string;
    /**
     * AWS secret access key used to sign S3 requests.
     */
    secretAccessKey: string;
    /**
     * Bucket name used for all file storage operations.
     */
    bucket: string;
    /**
     * AWS region for request signing.
     */
    region: string;
    /**
     * Custom S3-compatible endpoint URL. Defaults to AWS S3 for the given region.
     */
    endpoint?: string;
    /**
     * Whether to use path-style bucket URLs (`/bucket/key`). Defaults to `true` when `endpoint` is
     * provided and `false` otherwise.
     */
    forcePathStyle?: boolean;
    /**
     * Optional session token for temporary credentials.
     */
    sessionToken?: string;
    /**
     * Optional fetch implementation.
     */
    fetch?: typeof globalThis.fetch;
}
/**
 * Creates an S3-backed implementation of `FileStorage`.
 *
 * This works with AWS S3 and S3-compatible providers (for example MinIO or LocalStack) by
 * overriding the `endpoint` option.
 *
 * @param options Configuration for the S3 backend
 * @returns A `FileStorage` implementation backed by S3
 */
export declare function createS3FileStorage(options: S3FileStorageOptions): FileStorage;
//# sourceMappingURL=s3.d.ts.map