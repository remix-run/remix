import { RoutePattern } from "./route-pattern.js";
import * as Specificity from "./specificity.js";
export class ArrayMatcher {
    #patterns = [];
    add(pattern, data) {
        pattern = typeof pattern === 'string' ? new RoutePattern(pattern) : pattern;
        this.#patterns.push({ pattern, data });
    }
    match(url, compareFn = Specificity.descending) {
        let bestMatch = null;
        for (let entry of this.#patterns) {
            let match = entry.pattern.match(url);
            if (match) {
                if (bestMatch === null || compareFn(match, bestMatch) < 0) {
                    bestMatch = { ...match, data: entry.data };
                }
            }
        }
        return bestMatch;
    }
    matchAll(url, compareFn = Specificity.descending) {
        let matches = [];
        for (let entry of this.#patterns) {
            let match = entry.pattern.match(url);
            if (match) {
                matches.push({ ...match, data: entry.data });
            }
        }
        return matches.sort(compareFn);
    }
}
