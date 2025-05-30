import { defineConfig } from 'tsup';

export default defineConfig([
  // Platform-neutral build
  {
    clean: true,
    dts: true,
    entry: ['src/multipart-parser.ts'],
    format: ['cjs', 'esm'],
    platform: 'neutral',
  },
  // Node specific build
  {
    clean: true,
    dts: true,
    entry: ['src/multipart-parser.node.ts'],
    format: ['cjs', 'esm'],
    platform: 'node',
  },
]);
