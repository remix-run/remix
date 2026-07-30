import { colors } from "../colors.js";
import { normalizeLine } from "../normalize.js";
export class DotReporter {
    #failures = [];
    #pending = [];
    #dotCount = 0;
    #files = new Set();
    #quiet;
    #suites = new Set();
    constructor(options = {}) {
        this.#quiet = options.quiet === true;
    }
    onSectionStart(_label) { }
    onResult(results, _env) {
        for (let test of results.tests) {
            if (test.filePath)
                this.#files.add(test.filePath);
            if (test.suiteName)
                this.#suites.add(test.suiteName);
        }
        for (let test of results.tests) {
            if (this.#quiet && test.status === 'skipped')
                continue;
            if (test.status === 'passed') {
                process.stdout.write(colors.green('.'));
            }
            else if (test.status === 'skipped') {
                process.stdout.write(colors.dim('S'));
                if (test.reason) {
                    this.#pending.push({
                        name: formatFullName(test),
                        status: test.status,
                        reason: test.reason,
                    });
                }
            }
            else if (test.status === 'todo') {
                process.stdout.write(colors.dim('T'));
                if (test.reason) {
                    this.#pending.push({
                        name: formatFullName(test),
                        status: test.status,
                        reason: test.reason,
                    });
                }
            }
            else {
                process.stdout.write(colors.red('F'));
                this.#failures.push({ name: formatFullName(test), error: test.error });
            }
            this.#dotCount++;
        }
    }
    onSummary(counts, durationMs) {
        if (this.#dotCount > 0)
            console.log();
        for (let i = 0; i < this.#failures.length; i++) {
            let { name, error } = this.#failures[i];
            console.log(`\n  ${colors.red(`${i + 1})`)} ${name}`);
            if (error) {
                console.log(`     ${colors.red(error.message)}`);
                if (error.stack) {
                    let frames = error.stack
                        .split('\n')
                        .slice(1, 4)
                        .map((l) => `     ${normalizeLine(l).trim()}`)
                        .join('\n');
                    console.log(frames);
                }
            }
        }
        for (let pending of this.#pending) {
            let comment = pending.status === 'skipped' ? '# skipped' : '# todo';
            let color = pending.status === 'skipped' ? colors.dim : colors.yellow;
            console.log(`\n  ${color(`${pending.name} ${comment}: ${pending.reason}`)}`);
        }
        let { passed, failed, skipped, todo } = counts;
        let info = colors.cyan('ℹ');
        console.log();
        console.log(`${info} files ${this.#files.size}`);
        console.log(`${info} suites ${this.#suites.size}`);
        console.log(`${info} tests ${passed + failed + skipped + todo}`);
        console.log(`${info} pass ${passed}`);
        console.log(`${info} fail ${failed}`);
        if (skipped > 0)
            console.log(`${info} skipped ${skipped}`);
        if (todo > 0)
            console.log(`${info} todo ${todo}`);
        console.log(`${info} duration_ms ${durationMs.toFixed(5)}`);
        console.log();
    }
}
function formatFullName(test) {
    return test.name ? `${test.suiteName} > ${test.name}` : test.suiteName;
}
