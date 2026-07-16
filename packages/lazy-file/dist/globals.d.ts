declare global {
    interface ReadableStream<R = any> {
        values(options?: {
            preventCancel?: boolean;
        }): AsyncIterableIterator<R>;
        [Symbol.asyncIterator](): AsyncIterableIterator<R>;
    }
}
export {};
//# sourceMappingURL=globals.d.ts.map