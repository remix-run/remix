import { releaseVersion, releaseChangelog } from 'nx/release/index.js';

const dryRun = true;
const verbose = true;

await releaseVersion({ dryRun, verbose });

// Force exit because it's connected to the Nx daemon
process.exit(0);
