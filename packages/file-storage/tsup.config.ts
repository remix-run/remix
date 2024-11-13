import { defineConfig } from 'tsup';

export default defineConfig([
  // Platform-neutral build
  {
    clean: true,
    dts: true,
    entry: ['src/file-storage.ts', 'src/memory.ts'],
    format: ['cjs', 'esm'],
    platform: 'neutral',
  },
  // Node specific build
  {
    clean: false,
    dts: true,
    entry: ['src/local.ts'],
    format: ['cjs', 'esm'],
    platform: 'node',
  },
]);
