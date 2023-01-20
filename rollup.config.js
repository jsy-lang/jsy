import {builtinModules} from 'node:module'
import rpi_resolve from '@rollup/plugin-node-resolve'
import rpi_commonjs from '@rollup/plugin-commonjs'
import rpi_dgnotify from 'rollup-plugin-dgnotify'
import rpi_jsy from './stable/rollup-jsy-bootstrap.mjs'
import rpi_terser from '@rollup/plugin-terser'
import rpi_virtual from '@rollup/plugin-virtual'
import pkg from './package.json' assert {type: 'json'}

const _rpis_ = (defines, ...args) => [
  rpi_virtual({
    'code/jsy/version.js': `export const version = '${pkg.version}'`,
  }),
  rpi_jsy({defines}),
  rpi_resolve(),
  ...args,
  rpi_dgnotify()]

const _cfg_ = {
  external: id => /^\w*:/.test(id) || builtinModules.includes(id),
  plugins: _rpis_({}) }

let is_watch = process.argv.includes('--watch')
let fast_build = 'fast' === process.env.JSY_BUILD || is_watch
const _cfg_min_ = fast_build || is_watch || 'undefined'===typeof rpi_terser ? null
  : { ... _cfg_, plugins: [ ... _cfg_.plugins, rpi_terser() ]}


export default [
  ... add_jsy('index', {ext: '.js'}),
  ... add_jsy('all', {ext: '.js'}),

  ... fast_build ? [] : [
    ... add_jsy('scanner/index', {ext: '.js'}),
    ... add_jsy('cli_transpile'),

    ... add_jsy_web('jsy-script'),
    ... add_jsy('node-loader'),

    // add rpi_commonjs to support @rollup/pluginutils use of picomatch
    { ... _cfg_, input: 'code/rollup.jsy',
      plugins: [ rpi_commonjs(), ..._cfg_.plugins ],
      output: {file: 'esm/rollup.js', format: 'es', sourcemap: true} },
  ],
]



function * add_jsy(src_name, opt={}) {
  const input = `code/${src_name}${opt.ext || '.jsy'}`
  yield { ..._cfg_, input, output: [
    { file: `esm/${src_name}.js`, format: 'es', sourcemap: true }, ]}
}

function * add_jsy_web(src_name, opt={}) {
  const input = `code/${src_name}${opt.ext || '.jsy'}`
  yield { ..._cfg_, input, output: [
    { file: `esm/${src_name}.js`, format: 'es', sourcemap: true },
    { file: `iife/${src_name}.js`, format: 'iife', sourcemap: true }, ]}

  if (_cfg_min_)
    yield { ..._cfg_min_, input, output: [
      { file: `esm/${src_name}.min.js`, format: 'es', sourcemap: false },
      { file: `iife/${src_name}.min.js`, format: 'iife', sourcemap: false }, ]}
}
