import rpi_resolve from 'rollup-plugin-node-resolve'
import rpi_commonjs from 'rollup-plugin-commonjs'
import jsy_transpile_stable from '../stable/esm'
import rpi_bound_jsy_lite from '../rpi_jsy.mjs'


const sourcemap = true
const external = []

const rpi_jsy = rpi_bound_jsy_lite({jsy_transpile: jsy_transpile_stable})
const plugins = [rpi_jsy]

// unittesting compile rollup
const test_plugins = plugins.concat([
  rpi_resolve({ module: true, main: true }),
  rpi_commonjs({ include: 'node_modules/**'}),
])

export default [
  false && { input: `./unittest.jsy`, context: 'window', plugins: test_plugins,
    output: { file: './__unittest.iife.js', format: 'iife', name: `test_jsy_transpile`, sourcemap:'inline' } },

  { input: `./unittest.jsy`, plugins: test_plugins,
    output: { file: './__unittest.cjs.js', format: 'cjs', sourcemap:'inline' } },

].filter(Boolean)
