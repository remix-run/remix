import type { RoutePattern } from '../route-pattern.ts';
import type { Match } from './types.ts';
import { type MatcherLimits } from './limits.ts';
export declare class Trie<data = unknown> {
    #private;
    readonly ignoreCase: boolean;
    constructor(options?: {
        ignoreCase?: boolean;
        limits?: Partial<MatcherLimits>;
    });
    insert(pattern: string | RoutePattern, data: data): void;
    search(url: URL): Array<Match<string, data>>;
}
//# sourceMappingURL=trie.d.ts.map