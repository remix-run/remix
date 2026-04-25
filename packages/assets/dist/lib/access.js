import { createFileMatcher } from "./file-matcher.js";
export function createAccessPolicy(options) {
    let allowMatchers = options.allow.map((pattern) => createFileMatcher(pattern, options.rootDir));
    let denyMatchers = (options.deny ?? []).map((pattern) => createFileMatcher(pattern, options.rootDir));
    return {
        isAllowed(filePath) {
            if (!allowMatchers.some((matcher) => matcher(filePath)))
                return false;
            if (denyMatchers.length > 0 && denyMatchers.some((matcher) => matcher(filePath)))
                return false;
            return true;
        },
    };
}
