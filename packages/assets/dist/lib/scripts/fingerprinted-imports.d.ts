import type { EmittedModule } from './emit.ts';
import type { ResolvedModule } from './resolve.ts';
type EmitModuleWithRewrittenImports = (resolvedModule: ResolvedModule, getRewrittenImportUrl: (identityPath: string) => string) => Promise<EmittedModule>;
export declare function createFingerprintedImportEmitter(emitModule: EmitModuleWithRewrittenImports): (modules: ReadonlyMap<string, ResolvedModule>) => Promise<Map<string, EmittedModule>>;
export {};
//# sourceMappingURL=fingerprinted-imports.d.ts.map