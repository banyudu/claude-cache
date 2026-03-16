import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/prompt-hook.ts'],
  format: ['cjs'],
  target: 'node18',
  outDir: 'dist',
  clean: true,
  splitting: false,
  noExternal: ['yaml'],
});
