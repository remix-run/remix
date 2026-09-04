import type { CliContext } from '../cli-context.ts';
import { type RunRemixDoctorOptions } from '../doctor/run.ts';
import type { RemixDoctorCommandConfig } from '../remix-config.ts';
type DoctorCommandOptions = Pick<RunRemixDoctorOptions, 'fix' | 'json' | 'strict'>;
export declare function runDoctorCommand(argv: string[], context: CliContext): Promise<number>;
export declare function getDoctorCommandHelpText(target?: NodeJS.WriteStream): string;
export declare function resolveDoctorCommandOptions(argv: string[], config: RemixDoctorCommandConfig | undefined): DoctorCommandOptions;
export {};
//# sourceMappingURL=doctor.d.ts.map