import rpi_resolve from '@rollup/plugin-node-resolve'
import rpi_jsy from './esm/rollup.mjs'

const configs = []
export default configs

const sourcemap = true
const plugins = [
  rpi_resolve(),
  rpi_jsy(),
]

configs.push(
  { input: 'code/index.jsy',
    output: [
      {file: 'stable/jsy-self-bootstrap.mjs', sourcemap, format: 'es' },
      {file: 'stable/jsy-self-bootstrap.cjs', sourcemap, format: 'cjs' },
    ],
    plugins, external: []},

  { input: 'code/rollup.jsy',
    output: {file: 'stable/rollup-jsy-bootstrap.mjs', sourcemap, format: 'es' },
    plugins, external: ['path', 'util']},
)

