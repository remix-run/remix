import * as path from 'node:path';
import { colors } from "../colors.js";
import { normalizeLine } from "../normalize.js";
export class FilesReporter {
    #failures = [];
    #files = new Set();
    #suites = new Set();
    onSectionStart(_label) { }
    onResult(results, env) {
        for (let test of results.tests) {
            if (test.filePath)
                this.#files.add(test.filePath);
            if (test.suiteName)
                this.#suites.add(test.suiteName);
        }
        let filePath = results.tests[0]?.filePath;
        let fileName = filePath ? path.relative(process.cwd(), filePath) : '(unknown)';
        let envLabel = env ? ` ${colors.dim(`[${env}]`)}` : '';
        let totalDuration = results.tests.reduce((sum, t) => sum + t.duration, 0);
        let hasFailed = results.tests.some((t) => t.status === 'failed');
        let fileColor = hasFailed ? colors.red : colors.green;
        let duration = hasFailed ? '' : ` (${totalDuration.toFixed(2)}ms)`;
        console.log(`${colors.dim('▶')} ${fileColor(fileName)}${duration}${envLabel}`);
        if (hasFailed) {
            // Print failing tests with suite/test nesting using > separators
            for (let test of results.tests) {
                if (test.status !== 'failed')
                    continue;
                let fullName = test.name ? `${test.suiteName} > ${test.name}` : test.suiteName;
                console.log(`  ${colors.red('✗')} ${fullName}`);
                if (test.error) {
                    console.log(`    ${colors.red(`Error: ${test.error.message}`)}`);
                    if (test.error.stack) {
                        let stack = test.error.stack
                            .split('\n')
                            .map((line) => normalizeLine(line))
                            .join('\n');
                        console.log(`      ${stack.split('\n').slice(1, 5).join(`\n      `)}`);
                    }
                }
                this.#failures.push({ suiteName: test.suiteName, name: test.name, error: test.error });
            }
        }
    }
    onSummary(counts, durationMs) {
        if (this.#failures.length > 0) {
            console.log();
            console.log(colors.red('Failed tests:'));
            for (let i = 0; i < this.#failures.length; i++) {
                let { suiteName, name, error } = this.#failures[i];
                let fullName = name ? `${suiteName} > ${name}` : suiteName;
                console.log(`\n  ${colors.red(`${i + 1})`)} ${fullName}`);
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
