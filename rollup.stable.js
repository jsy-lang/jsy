import jsy_transpile_tip from './esm/index.mjs'
import rpi_bound_jsy_lite from './rpi_jsy.mjs'

const configs = []
export default configs

const sourcemap = true
const external = []

const rpi_jsy = rpi_bound_jsy_lite({ jsy_transpile: jsy_transpile_tip })
const plugins = [rpi_jsy]

configs.push(
  { input: 'code/index.jsy',
    output: [
      {file: 'stable/jsy-self-bootstrap.mjs', sourcemap, format: 'es' },
      {file: 'stable/jsy-self-bootstrap.cjs', sourcemap, format: 'cjs' },
    ],
    plugins, external})

