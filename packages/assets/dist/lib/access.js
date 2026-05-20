import { createFileMatcher } from "./file-matcher.js";
import { isInjectedPackageFilePath } from "./injected-packages.js";
export function createAccessPolicy(options) {
    let allowMatchers = options.allow.map((pattern) => createFileMatcher(pattern, options.rootDir));
    let denyMatchers = (options.deny ?? []).map((pattern) => createFileMatcher(pattern, options.rootDir));
    function isDenied(filePath) {
        if (isInjectedPackageFilePath(filePath))
            return false;
        return denyMatchers.length > 0 && denyMatchers.some((matcher) => matcher(filePath));
    }
    return {
        isDenied,
        isAllowed(filePath) {
            if (isInjectedPackageFilePath(filePath))
                return true;
            if (!allowMatchers.some((matcher) => matcher(filePath)))
                return false;
            if (isDenied(filePath))
                return false;
            return true;
        },
    };
}
