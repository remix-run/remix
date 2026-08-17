export function createFailedResults(error) {
    return {
        passed: 0,
        failed: 1,
        skipped: 0,
        todo: 0,
        tests: [
            {
                name: '',
                suiteName: '',
                status: 'failed',
                duration: 0,
                error: {
                    message: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                },
            },
        ],
    };
}
