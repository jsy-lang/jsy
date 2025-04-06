import rpi_resolve from '@rollup/plugin-node-resolve'
import rpi_commonjs from '@rollup/plugin-commonjs'
import rpi_jsy from './esm/rollup.js'

const _cfg_ = {
  external: id => /^\w*:/.test(id),
  plugins: [ rpi_resolve(), rpi_jsy() ],
}

export default [
  { ..._cfg_, input: 'code/index.js', output:
    {file: 'stable/jsy-self-bootstrap.mjs', sourcemap: true, format: 'es' }},

  { ..._cfg_, plugins: [rpi_commonjs(), ..._cfg_.plugins],
    input: 'code/rollup.js', output:
    {file: 'stable/rollup-jsy-bootstrap.mjs', sourcemap: true, format: 'es' }},
]

