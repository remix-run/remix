import { defineConfig } from 'tsup';

export default defineConfig([
  // Node specific build
  {
    clean: false,
    dts: true,
    entry: ['src/local.ts'],
    format: ['cjs', 'esm'],
    platform: 'node',
  },
  // Platform-neutral build
  {
    clean: false,
    dts: true,
    entry: ['src/file-storage.ts', 'src/memory.ts'],
    format: ['cjs', 'esm'],
    platform: 'neutral',
  },
]);
