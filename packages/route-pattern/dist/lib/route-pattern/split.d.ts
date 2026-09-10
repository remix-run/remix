export type Span = [begin: number, end: number];
export type SplitResult = {
    protocol: Span | null;
    hostname: Span | null;
    port: Span | null;
    pathname: Span | null;
    search: Span | null;
};
/**
 * Split a route pattern into protocol, hostname, port, pathname, and search
 * spans delimited as `protocol://hostname:port/pathname?search`.
 *
 * Delimiters are not included in the spans with the exception of the leading `/` for pathname.
 * Spans are [begin (inclusive), end (exclusive)].
 *
 * @param source the route pattern string to split
 * @returns an object containing spans for each URL component
 */
export declare function split(source: string): SplitResult;
//# sourceMappingURL=split.d.ts.map