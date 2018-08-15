import { createFilter } from 'rollup-pluginutils'

const { SourceMapGenerator } = require('source-map')
const default_config = { exclude: 'node_modules/**' }

export default rpi_bound_jsy_lite
function rpi_bound_jsy_lite(config=default_config) {
  const jsy_transpile = config.jsy_transpile
  const filter = createFilter(config.include, config.exclude)
  const sourcemap = false !== config.sourcemap && false !== config.sourceMap
  if ( 'function' !== typeof jsy_transpile )
    throw new TypeError('Expected jsy_transpile option to be a function')

  return {
    name: 'jsy-lite',
    transform(code, id) {
      if (! filter(id)) return

      const src_map = sourcemap ? new SourceMapGenerator() : null

      const res = jsy_transpile(code, {
        addSourceMapping(arg) {
          if (null === src_map) return;
          arg.source = id
          src_map.addMapping(arg)
        },
      })
      return { code: res, map: src_map.toJSON() } },
} }
