import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts', mera: 'src/mera.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2022',
  external: ['@category-labs/mera', '@category-labs/mera/viem', 'viem', '@noble/curves', '@noble/hashes'],
});
