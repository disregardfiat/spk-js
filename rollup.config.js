const { nodeResolve } = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const typescript = require('@rollup/plugin-typescript');
const { babel } = require('@rollup/plugin-babel');
const terser = require('@rollup/plugin-terser');
const json = require('@rollup/plugin-json');
const nodePolyfills = require('rollup-plugin-node-polyfills');
const dts = require('rollup-plugin-dts');

const production = !process.env.ROLLUP_WATCH;

module.exports = [
  // CommonJS build for Node.js/Electron
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/spk-js.cjs.js',
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
      inlineDynamicImports: true
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
        declaration: false,
        declarationMap: false
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
      sourcemap: true,
      inlineDynamicImports: true
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
        declaration: false,
        declarationMap: false
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
      },
      inlineDynamicImports: true
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
        declaration: false,
        declarationMap: false
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
      sourcemap: true,
      inlineDynamicImports: true
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
        declaration: false,
        declarationMap: false
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
    plugins: [dts.default()]
  }
];