export declare function createRequest(url: string, fromResponse?: Response, init?: RequestInit): Request;
export declare function mockFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response>): () => void;
export interface FakeOAuthProfile {
    sub: string;
    email?: string;
    name?: string;
}
export type FakeOAuthServer = {
    origin: string;
    close: () => Promise<void>;
};
export declare function startFakeOAuthServer(profile?: FakeOAuthProfile): Promise<FakeOAuthServer>;
//# sourceMappingURL=test-utils.d.ts.map