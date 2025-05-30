import * as cp from 'node:child_process';

/** @type (command: string, options?: cp.ExecSyncOptions) => void */
export function logAndExec(command, options) {
  console.log(`$ ${command}`);
  cp.execSync(command, { stdio: 'inherit', ...options });
}
