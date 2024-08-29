import { releaseVersion, releaseChangelog, releasePublish } from 'nx/release/index.js';

const dryRun = false;
const verbose = true;

let { projectsVersionData } = await releaseVersion({ dryRun, verbose });

await releaseChangelog({ dryRun, verbose, versionData: projectsVersionData });

let statusCode = await releasePublish({ dryRun, verbose });

// Force exit because it's connected to the Nx daemon
process.exit(0);
