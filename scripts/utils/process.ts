import * as cp from 'node:child_process';

export function logAndExec(command: string, options?: cp.ExecSyncOptions): void {
  console.log(`$ ${command}`);
  cp.execSync(command, { stdio: 'inherit', ...options });
}
