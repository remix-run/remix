import { colors } from "../colors.js";
import { normalizeLine } from "../normalize.js";
export class DotReporter {
    #failures = [];
    #dotCount = 0;
    onSectionStart(_label) { }
    onResult(results, _env) {
        for (let test of results.tests) {
            if (test.status === 'passed') {
                process.stdout.write(colors.green('.'));
            }
            else if (test.status === 'skipped') {
                process.stdout.write(colors.dim('S'));
            }
            else if (test.status === 'todo') {
                process.stdout.write(colors.dim('T'));
            }
            else {
                process.stdout.write(colors.red('F'));
                this.#failures.push({ name: `${test.suiteName} > ${test.name}`, error: test.error });
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
        let { passed, failed, skipped, todo } = counts;
        let info = colors.cyan('ℹ');
        console.log();
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
