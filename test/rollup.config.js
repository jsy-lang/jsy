import rpi_resolve from '@rollup/plugin-node-resolve'
import rpi_commonjs from '@rollup/plugin-commonjs'
import rpi_jsy from '../stable/rollup-jsy-bootstrap.mjs'

const _cfg_ = {
  plugins: [
    rpi_jsy({
      include: [ '**/*.jsy', 'scanners/*.js', 'unit/*.js' ],
    }),
    rpi_resolve(),
    rpi_commonjs({ include: 'node_modules/**'}),
  ]
}

export default [
  { ..._cfg_, input: `./unittest.jsy`, context: 'window',
    output: { file: './__unittest.iife.js', format: 'iife', name: `test_jsy_transpile`, sourcemap: 'inline' } },

  { ..._cfg_, input: `./unittest.jsy`,
    output: { file: './__unittest.cjs.js', format: 'cjs', sourcemap: 'inline' } },
]
