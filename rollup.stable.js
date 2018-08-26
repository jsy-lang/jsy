const pkg = require('./package.json')
const jsy_transpile_tip = require('./cjs/index.js')

import rpi_bound_jsy_lite from './rpi_jsy'

const configs = []
export default configs

const sourcemap = true
const external = []

const rpi_jsy = rpi_bound_jsy_lite({jsy_transpile: jsy_transpile_tip})
const plugins = [rpi_jsy]

configs.push(
  { input: 'code/index.jsy',
    output: [
      {file: 'stable/esm.js', sourcemap, format: 'es' },
      {file: 'stable/cjs.js', sourcemap, format: 'cjs' },
    ],
    plugins, external})

