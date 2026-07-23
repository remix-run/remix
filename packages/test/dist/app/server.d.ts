import * as http from 'node:http';
import { type SerializedOnlyPattern } from '../lib/config.ts';
export declare function startServer(browserFiles: string[], options?: {
    only?: SerializedOnlyPattern[];
}): Promise<{
    server: http.Server;
    port: number;
    baseUrl: string;
}>;
//# sourceMappingURL=server.d.ts.map