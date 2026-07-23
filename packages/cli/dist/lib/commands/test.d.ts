import type { RemixTestConfig, RemixTestPool } from '@remix-run/test/cli';
import type { CliContext } from '../cli-context.ts';
import type { RemixTestCommandConfig } from '../remix-config.ts';
/**
 * Flag descriptors for `remix test`, derived from the parse table so that
 * argument parsing, help text, and shell completion share one source of truth.
 */
export interface TestCommandFlag {
    /** Long flag, e.g. `--glob.test`. */
    name: string;
    /** Short alias, e.g. `-c`. */
    alias?: string;
    type: 'boolean' | 'string';
    /** Whether the flag may be repeated. */
    multiple: boolean;
    /** Whether the flag's value completes as a file path. */
    files: boolean;
}
export declare const testCommandFlags: TestCommandFlag[];
export declare function runTestCommand(argv: string[], context: CliContext): Promise<number>;
export declare function resolveTestCommandOptions(argv: string[], config: RemixTestCommandConfig | undefined, pools: readonly RemixTestPool[]): RemixTestConfig;
export declare function getTestCommandHelpText(target?: NodeJS.WriteStream): string;
//# sourceMappingURL=test.d.ts.map