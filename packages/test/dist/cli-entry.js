#!/usr/bin/env node
import * as process from 'node:process';
import { runRemixTest } from "./cli.js";
try {
    let exitCode = await runRemixTest({
        argv: process.argv.slice(2),
        cwd: process.cwd(),
    });
    process.exit(exitCode);
}
catch (error) {
    console.error('Error running tests:', error);
    process.exit(1);
}
