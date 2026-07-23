import { DotReporter } from "./dot.js";
import { FilesReporter } from "./files.js";
import { SpecReporter } from "./spec.js";
import { TapReporter } from "./tap.js";
export { DotReporter, FilesReporter, SpecReporter, TapReporter };
export function createReporter(type, options = {}) {
    switch (type) {
        case 'tap':
            return new TapReporter(options);
        case 'dot':
            return new DotReporter(options);
        case 'files':
            return new FilesReporter(options);
        case 'spec':
        default:
            return new SpecReporter(options);
    }
}
