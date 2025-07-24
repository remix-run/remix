import * as fs from 'node:fs';

import { getChanges } from './utils/changes.js';
import { getPackageDir, packagesDir } from './utils/packages.js';

let packageName = process.argv[2];

/** @type {(packageName: string) => import('./utils/changes.js').Changes | null} */
function getPackageChanges(packageName) {
  let changes = getChanges(packageName, 'HEAD');

  if (!changes || !changes.body.trim()) {
    return null;
  }

  return changes;
}

/** @type {(packageName: string, changes: import('./utils/changes.js').Changes) => void} */
function printPackageChanges(packageName, changes) {
  console.log(`📦 ${packageName}`);
  console.log('─'.repeat(50));
  console.log(changes.body);
  console.log();
}

if (packageName) {
  let dir = getPackageDir(packageName);

  if (!fs.existsSync(dir)) {
    console.error(`Error: Package "${packageName}" not found in ./packages`);
    process.exit(1);
  }

  let changes = getPackageChanges(packageName);

  if (changes) {
    printPackageChanges(packageName, changes);
  } else {
    console.log(`No pending changes found for package "${packageName}"`);
    console.log();
  }
} else {
  let packages = fs.readdirSync(packagesDir).filter((name) => {
    let dir = getPackageDir(name);
    return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
  });

  let hasChanges = false;

  packages.forEach((pkg) => {
    let changes = getPackageChanges(pkg);
    if (changes) {
      hasChanges = true;
      printPackageChanges(pkg, changes);
    }
  });

  if (!hasChanges) {
    console.log('No packages have pending changes');
    console.log();
  }
}
