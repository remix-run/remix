import { getChanges } from './utils/changes.js';
import { getAllPackageNames, packageExists } from './utils/packages.js';

/** @type {(packageName: string, changes: import('./utils/changes.js').Changes) => void} */
function printPackageChanges(packageName, changes) {
  console.log(`📦 ${packageName}`);
  console.log('─'.repeat(50));
  console.log(changes.body);
  console.log();
}

let packageName = process.argv[2];

if (packageName) {
  if (!packageExists(packageName)) {
    console.error(`Error: Package "${packageName}" not found in ./packages`);
    process.exit(1);
  }

  let changes = getChanges(packageName, 'HEAD');

  if (changes) {
    printPackageChanges(packageName, changes);
  } else {
    console.log(`No pending changes found for package "${packageName}"`);
    console.log();
  }
} else {
  let hasChanges = false;

  let packageNames = getAllPackageNames();
  packageNames.forEach((packageName) => {
    let changes = getChanges(packageName, 'HEAD');
    if (changes) {
      hasChanges = true;
      printPackageChanges(packageName, changes);
    }
  });

  if (!hasChanges) {
    console.log('No packages have pending changes');
    console.log();
  }
}
