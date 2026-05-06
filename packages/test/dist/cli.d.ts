import { getRemixTestHelpText } from './lib/config.ts';
export { getRemixTestHelpText };
export interface RunRemixTestOptions {
    argv?: string[];
    cwd?: string;
}
export declare function runRemixTest(options?: RunRemixTestOptions): Promise<number>;
//# sourceMappingURL=cli.d.ts.map