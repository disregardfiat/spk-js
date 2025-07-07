import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import { babel } from '@rollup/plugin-babel';
import terser from '@rollup/plugin-terser';
import json from '@rollup/plugin-json';
import nodePolyfills from 'rollup-plugin-node-polyfills';
import dts from 'rollup-plugin-dts';

const production = !process.env.ROLLUP_WATCH;

export default [
  // CommonJS build for Node.js/Electron
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/spk-js.cjs.js',
      format: 'cjs',
      sourcemap: true,
      exports: 'named'
    },
    plugins: [
      nodeResolve({
        preferBuiltins: true,
        exportConditions: ['node']
      }),
      commonjs(),
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false
      }),
      production && terser()
    ],
    external: [
      '@hiveio/hive-js',
      'ipfs-only-hash',
      'buffer',
      'events',
      'crypto',
      'util',
      'stream'
    ]
  },

  // ES module build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/spk-js.esm.js',
      format: 'es',
      sourcemap: true
    },
    plugins: [
      nodeResolve({
        browser: true,
        preferBuiltins: false
      }),
      commonjs(),
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false
      }),
      production && terser()
    ],
    external: [
      '@hiveio/hive-js',
      'ipfs-only-hash',
      'buffer'
    ]
  },

  // Browser-friendly UMD build
  {
    input: 'src/index.ts',
    output: {
      name: 'SPK',
      file: 'dist/spk-js.umd.js',
      format: 'umd',
      sourcemap: true,
      globals: {
        buffer: 'Buffer'
      }
    },
    plugins: [
      nodeResolve({
        browser: true,
        preferBuiltins: false
      }),
      commonjs(),
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false
      }),
      babel({
        babelHelpers: 'bundled',
        exclude: 'node_modules/**',
        presets: [
          ['@babel/preset-env', {
            targets: '> 0.25%, not dead'
          }]
        ]
      }),
      nodePolyfills(),
      production && terser()
    ],
    external: []
  },

  // Minified browser build
  {
    input: 'src/index.ts',
    output: {
      name: 'SPK',
      file: 'dist/spk-js.min.js',
      format: 'iife',
      sourcemap: true
    },
    plugins: [
      nodeResolve({
        browser: true,
        preferBuiltins: false
      }),
      commonjs(),
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false
      }),
      babel({
        babelHelpers: 'bundled',
        exclude: 'node_modules/**',
        presets: [
          ['@babel/preset-env', {
            targets: '> 0.25%, not dead'
          }]
        ]
      }),
      nodePolyfills(),
      terser()
    ],
    external: []
  },

  // TypeScript declarations
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'es'
    },
    plugins: [dts()]
  }
];