import * as pkg from './package.json'
import rpi_babel from 'rollup-plugin-babel'

const configs = []
export default configs

const sourcemap = 'inline'
const external = []
const plugins = [jsy_babel()]
const plugins_browser = plugins.slice()

//import rpi_terser from 'rollup-plugin-terser'
//plugins_browser.push(rpi_terser())

configs.push(
  { input: 'code/index.jsy',
    output: [
      { file: pkg.main, sourcemap, format: 'cjs' },
      { file: pkg.module, sourcemap, format: 'es' },
    ],
    plugins, external},

  { input: 'code/index.jsy',
    output: { file: pkg.browser, sourcemap, format: 'umd', name:'jsy_transpile' },
    plugins: plugins_browser, external})


function jsy_babel() {
  return rpi_babel({
    presets: [],
    plugins: ['offside-js'],
    babelrc: false,
    exclude: 'node_modules/**',
  }) }
