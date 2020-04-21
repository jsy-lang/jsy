import rpi_resolve from '@rollup/plugin-node-resolve'
import rpi_jsy from './stable/rollup-jsy-bootstrap.mjs'
import {terser as rpi_terser} from 'rollup-plugin-terser'

const configs = []
export default configs

const sourcemap = true

const plugins = [
  rpi_resolve(),
  rpi_jsy(),
]

const plugins_web_min = [
  ...plugins,
  rpi_terser(),
]


add_jsy_core('index', {name: 'jsy_transpile', exports:'default'})
add_jsy_core('with_srcmap', {name: 'jsy_transpile'})
add_jsy_core('scanner/index')
add_jsy_core('all')


add_jsy_web('jsy-script')


add_jsy_node('rollup', ['esm'], {external: ['path', 'util']})
add_jsy_node('cli_transpile', ['cjs'], {external: ['path', 'util', 'fs']})



function add_jsy_core(src_name, opt={}) {
  configs.push({
    input: `code/${src_name}.jsy`,
    output: [
      { file: `cjs/${src_name}.js`, format: 'cjs', exports:opt.exports || 'named', sourcemap },
      { file: `cjs/${src_name}.cjs`, format: 'cjs', exports:opt.exports || 'named', sourcemap },
      { file: `esm/${src_name}.js`, format: 'es', sourcemap },
      { file: `esm/${src_name}.mjs`, format: 'es', sourcemap },
    ],
    plugins })

  if (opt.name && plugins_web_min)
    configs.push({
      input: `code/${src_name}.jsy`,
      output: { file: `umd/${src_name}.js`, format: 'umd', name: opt.name, exports:opt.exports || 'named', sourcemap },
      plugins: plugins_web_min })
}

function add_jsy_web(src_name, name=src_name) {
  configs.push({
    input: `code/${src_name}.jsy`,
    output: [
      { file: `esm/${src_name}.mjs`, format: 'es', sourcemap },
      { file: `umd/${src_name}.js`, format: 'umd', name, sourcemap },
      { file: `iife/${src_name}.js`, format: 'iife', sourcemap },
    ],
    plugins })

  if (plugins_web_min)
    configs.push({
      input: `code/${src_name}.jsy`,
      output: [
        { file: `esm/${src_name}.min.mjs`, format: 'es', sourcemap },
        { file: `umd/${src_name}.min.js`, format: 'umd', name, sourcemap },
        { file: `iife/${src_name}.min.js`, format: 'iife', sourcemap },
      ],
      plugins: plugins_web_min })
}

function add_jsy_node(src_name, output_formats, kw={}) {
  const fmt_map = {'esm': 'es', 'cjs': 'cjs'}
  const fmt_ext = {'esm': 'mjs', 'cjs': 'cjs'}

  configs.push({
    input: `code/${src_name}.jsy`,
    output: output_formats.map(fmt => (
      { file: `${fmt}/${src_name}.${fmt_ext[fmt].trim()}`,
        format: fmt_map[fmt].trim(),
        exports: 'named' ,
        sourcemap,
      })),
    plugins, ...kw})
}
