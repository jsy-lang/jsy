import * as pkg from './package.json'
import rpi_jsy from 'rollup-plugin-jsy-babel'

const sourcemap = 'inline'
const external = []
const plugins = [rpi_jsy()]

export default {
  input: 'code/index.jsy',
  output: [
    { file: pkg.main, sourcemap, format: 'cjs' },
    { file: pkg.module, sourcemap, format: 'es' },
  ],
  plugins, external: []}

