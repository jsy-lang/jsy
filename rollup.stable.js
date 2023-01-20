import rpi_resolve from '@rollup/plugin-node-resolve'
import rpi_dgnotify from 'rollup-plugin-dgnotify'
import rpi_jsy from './esm/rollup.mjs'

const _cfg_ = {
  external: id => /^\w*:/.test(id),
  plugins: [ rpi_resolve(), rpi_jsy(), rpi_dgnotify() ],
}

export default [
  { ..._cfg_, input: 'code/index.jsy', output:
    {file: 'stable/jsy-self-bootstrap.mjs', sourcemap: true, format: 'es' }},

  { ..._cfg_, input: 'code/rollup.jsy', output:
    {file: 'stable/rollup-jsy-bootstrap.mjs', sourcemap: true, format: 'es' }},
]

