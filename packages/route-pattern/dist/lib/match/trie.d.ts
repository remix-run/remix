import type { RoutePattern } from '../route-pattern.ts';
import type { Match } from './types.ts';
export declare class Trie<data = unknown> {
    #private;
    readonly ignoreCase: boolean;
    constructor(options?: {
        ignoreCase?: boolean;
    });
    insert(pattern: RoutePattern, data: data): void;
    search(url: URL): Array<Match<string, data>>;
}
//# sourceMappingURL=trie.d.ts.map