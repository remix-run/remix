import { DotReporter } from "./dot.js";
import { FilesReporter } from "./files.js";
import { SpecReporter } from "./spec.js";
import { TapReporter } from "./tap.js";
export { DotReporter, FilesReporter, SpecReporter, TapReporter };
export function createReporter(type) {
    switch (type) {
        case 'tap':
            return new TapReporter();
        case 'dot':
            return new DotReporter();
        case 'files':
            return new FilesReporter();
        case 'spec':
        default:
            return new SpecReporter();
    }
}
