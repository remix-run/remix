import * as http from 'node:http';
import { type SerializedTestNamePattern } from '../lib/config.ts';
export declare function startServer(browserFiles: string[], options?: {
    testNamePatterns?: SerializedTestNamePattern[];
}): Promise<{
    server: http.Server;
    port: number;
    baseUrl: string;
}>;
//# sourceMappingURL=server.d.ts.map