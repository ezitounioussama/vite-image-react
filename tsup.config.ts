import { defineConfig } from 'tsup'

const common = {
  dts: false,
  clean: true,
  external: ['sharp', 'react', 'vite', 'next'],
  splitting: true,
  minify: false,
  keepNames: false,
  target: 'esnext',
  sourcemap: false,
}

export default defineConfig([
  {
    ...common,
    entry: {
      index: 'src/index.ts',
      'vite-plugin': 'src/vite-plugin.ts',
      'next-plugin': 'src/next-plugin.ts',
    },
    format: 'esm',
    dts: true,
  },
  {
    ...common,
    entry: {
      'next-image-loader': 'src/next-image-loader.ts',
    },
    format: 'cjs',
    outExtension: () => ({ js: '.cjs' }),
  },
])
