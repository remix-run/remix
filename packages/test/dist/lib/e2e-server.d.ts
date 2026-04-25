export interface CreateServerFunction {
    (handler: (req: Request) => Promise<Response>): Promise<{
        baseUrl: string;
        close(): Promise<void>;
    }>;
}
export declare function createServer(handler: (req: Request) => Promise<Response>): Promise<{
    baseUrl: string;
    close(): Promise<void>;
}>;
//# sourceMappingURL=e2e-server.d.ts.map