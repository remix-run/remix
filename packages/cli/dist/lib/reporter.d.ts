interface StepProgressLabel {
    complete: string;
    running?: string;
}
export interface CommandReporter {
    finish(): void;
    out: TextChannel;
    status: StatusChannel;
}
export interface TableOptions {
    headers: string[];
    noHeaders?: boolean;
    rows: string[][];
    formatRow?: (line: string, rowIndex: number) => string;
}
export interface TextChannel {
    blank(): void;
    bullet(text: string): void;
    bullets(items: string[]): void;
    dedent(): void;
    indent(): void;
    label(tag: string, text: string, options?: LabelOptions): string;
    line(text?: string): void;
    section(title: string, callback?: () => void): void;
    table(options: TableOptions): void;
    withIndent<result>(callback: () => result): result;
}
export interface StatusChannel extends TextChannel {
    commandHeader(commandLabel: string): Promise<void>;
    failStep(label?: string): void;
    skipStep(label: string, reason?: string): void;
    startStep(label: string): void;
    succeedStep(label?: string): void;
    summaryGap(): void;
}
export interface LabelOptions {
    tone?: 'error' | 'warn';
}
export interface CreateCommandReporterOptions {
    remixVersion?: string;
    stderr?: NodeJS.WriteStream;
    statusFrameIntervalMs?: number;
    stdout?: NodeJS.WriteStream;
}
export interface StepProgressReporter<step extends string> {
    fail(step: step): void;
    skip(step: step, reason?: string): void;
    start(step: step): void;
    succeed(step: step): void;
    writeSummaryGap(): void;
}
export declare function createCommandReporter(options?: CreateCommandReporterOptions): CommandReporter;
export declare function createStepProgressReporter<step extends string>(status: StatusChannel, labels: Record<step, string | StepProgressLabel>): StepProgressReporter<step>;
export declare function runProgressStep<step extends string, result>(progress: StepProgressReporter<step> | null | undefined, step: step, callback: () => Promise<result>): Promise<result>;
export {};
//# sourceMappingURL=reporter.d.ts.map