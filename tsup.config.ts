import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'vite-plugin': 'src/vite-plugin.ts',
  },
  format: 'esm',
  dts: true,
  clean: true,
  external: ['sharp', 'react', 'vite'],
  splitting: true,
})
