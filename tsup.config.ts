import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/prompt-hook.ts', 'src/session-start-hook.ts'],
  format: ['cjs'],
  target: 'node18',
  outDir: 'dist',
  clean: true,
  splitting: false,
  noExternal: ['yaml'],
  banner: { js: '#!/usr/bin/env node' },
});
