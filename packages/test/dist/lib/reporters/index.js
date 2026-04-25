import { SpecReporter } from "./spec.js";
import { TapReporter } from "./tap.js";
import { DotReporter } from "./dot.js";
import { FilesReporter } from "./files.js";
export { SpecReporter, TapReporter, DotReporter, FilesReporter };
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
