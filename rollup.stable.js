const pkg = require('./package.json')
const jsy_transpile = require('./cjs/index.js')

import rpi_babel from 'rollup-plugin-babel'
import rpi_bound_jsy_lite from './rpi_jsy'

const configs = []
export default configs

const rpi_jsy = rpi_bound_jsy_lite({jsy_transpile})
const sourcemap = true
const external = []
const plugins = [rpi_jsy]

configs.push(
  { input: 'code/index.jsy',
    output: { file: 'stable/index.js', sourcemap, format: 'cjs' },
    plugins, external})

function jsy_babel() {
  return rpi_babel({
    presets: [],
    plugins: ['offside-js'],
    babelrc: false,
    exclude: 'node_modules/**',
  }) }
