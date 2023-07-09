import { jsy_transpile_srcmap, version } from './jsy/with_srcmap.jsy'
import { createFilter } from '@rollup/pluginutils'

export default function jsy_rollup_plugin(config) {
  config = {
    include: ['**/*.jsy'],
    exclude: ['node_modules/**'],
    ... config }

  const filter = createFilter(config.include, config.exclude)
  const sourcemap = false !== config.sourcemap && false !== config.sourceMap
  const { preprocessor, defines } = config
  if (! preprocessor && config.preprocess)
    preprocessor = () => config.preprocess

  return {
    name: `jsy-${version}`,
    transform(code, id) {
      if (! filter(id)) return

      try {
        let jsy = jsy_transpile_srcmap( code, id, {
          ... config.jsy, as_rec: true,
          preprocessor, defines,
          sourcemap, })

        return { code: jsy.code, map: jsy.srcmap.toJSON() }

      } catch (err) {
        if (undefined !== err.src_loc)
          this.error(err, err.src_loc.pos)
        else throw err
      }
    }
  }
}
