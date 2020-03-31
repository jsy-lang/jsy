import { createFilter } from '@rollup/pluginutils'
import jsy_transpile_stable from './stable/jsy-self-bootstrap.mjs'
import tiny_sourcemap from 'tiny-source-map'

const { SourceMapGenerator } = require('source-map')
const default_config = {
  exclude: 'node_modules/**',
  jsy_transpile: jsy_transpile_stable,
}

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

      const src_map_base = sourcemap ? new SourceMapGenerator() : null
      const src_map_mini = sourcemap ? tiny_sourcemap() : null

      const res = jsy_transpile(code, {
        addSourceMapping(arg) {
          if (null === src_map_base) return;
          arg.source = id
          src_map_base.addMapping(arg)
          if (null !== src_map_mini)
            src_map_mini.addMapping(arg)
        },
      })

      const map_baseline = src_map_base.toJSON()

      if (null !== src_map_mini) {
        // test mini_sourcemap generation accuracy

        const map_mini = src_map_mini.toJSON()
        const v0 = map_baseline.mappings.split(';')
        const v1 = map_mini.mappings.split(';')

        const zv = Array.from(
          {length: Math.max(v0.length, v1.length)},
          (_,i) => v0[i] === v1[i] ? 1 : 0 )
        console.assert(zv.every(Boolean), 'mini-source-map deviation from source-map/SourceMapGenerator')
      }

      return { code: res, map: map_baseline } },
} }
