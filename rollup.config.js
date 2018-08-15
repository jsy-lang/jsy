const pkg = require('./package.json')
const jsy_transpile = require('./stable/index.js')

import rpi_bound_jsy_lite from './rpi_jsy'

const configs = []
export default configs

const sourcemap = true
const external = []

const rpi_jsy = rpi_bound_jsy_lite({jsy_transpile})
const plugins = [rpi_jsy]
const plugins_browser = plugins.slice()

import {terser as rpi_terser} from 'rollup-plugin-terser'
if (plugins_browser)
  plugins_browser.push(rpi_terser())

configs.push(
  { input: 'code/index.jsy',
    output: [
      { file: pkg.main, sourcemap, format: 'cjs' },
      { file: pkg.module, sourcemap, format: 'es' },
    ],
    plugins, external})

if (plugins_browser)
  configs.push(
    { input: 'code/index.jsy',
      output: { file: pkg.browser, sourcemap, format: 'umd', name:'jsy_transpile' },
      plugins: plugins_browser, external})


const direct = [
  'scanner/index',
  'all',
].forEach(add_jsy)



function add_jsy(name) {
  configs.push({
    input: `code/${name}.jsy`,
    output: [
      { file: `cjs/${name}.js`, format: 'cjs', exports:'named', sourcemap },
      { file: `esm/${name}.js`, format: 'es', sourcemap },
    ],
    plugins, external })

  if (plugins_browser)
    configs.push({
      input: `code/${name}.jsy`,
      output: { file: `umd/${name}.js`, format: 'umd', name, exports:'named', sourcemap },
      plugins: plugins_browser, external })
}


/*
import rpi_babel from 'rollup-plugin-babel'
//const plugins = [jsy_babel()]
function jsy_babel() {
  return rpi_babel({
    presets: [],
    plugins: ['offside-js'],
    babelrc: false,
    exclude: 'node_modules/**',
  }) }
*/
