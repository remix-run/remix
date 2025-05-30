import { defineConfig } from 'tsup';

export default defineConfig([
  // Platform-neutral build
  {
    clean: true,
    dts: true,
    entry: ['src/lazy-file.ts'],
    format: ['cjs', 'esm'],
    platform: 'neutral',
  },
  // Node specific build
  {
    clean: true,
    dts: true,
    entry: ['src/fs.ts'],
    format: ['cjs', 'esm'],
    platform: 'node',
  },
]);
