export type Assert<T extends true> = T;
export type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;
export declare function drain(stream: ReadableStream<Uint8Array>): Promise<string>;
export declare function readChunks(stream: ReadableStream<Uint8Array>): AsyncGenerator<string, void, void>;
export declare function withResolvers<T = unknown>(): [
    Promise<T>,
    (value: T) => void,
    (error: unknown) => void
];
