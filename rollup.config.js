import pkg from './package.json'
import rpi_resolve from '@rollup/plugin-node-resolve'
import rpi_jsy from './stable/rollup-jsy-bootstrap.mjs'
import {terser as rpi_terser} from 'rollup-plugin-terser'

const configs = []
export default configs

const sourcemap = true
const external = []

const plugins = [
  rpi_resolve(),
  rpi_jsy(),
]

const plugins_browser = [
  ...plugins,
  rpi_terser(),
]

configs.push(
  { input: 'code/index.jsy',
    output: [
      { file: pkg.main, sourcemap, format: 'cjs' },
      { file: pkg.main.replace('.cjs', '.js'), sourcemap, format: 'cjs' },
      { file: pkg.module, sourcemap, format: 'es' },
      { file: pkg.module.replace('.mjs', '.js'), sourcemap, format: 'es' },
    ],
    plugins, external},

  { input: 'code/jsy-script.jsy',
    output: [
      { file: 'esm/jsy-script.js', sourcemap, format: 'es'},
      { file: 'esm/jsy-script.mjs', sourcemap, format: 'es'},
    ],
    plugins: plugins_browser, external},

  { input: 'code/rollup.jsy',
    output: { file: 'esm/rollup.mjs', sourcemap, format: 'es'},
    plugins, external: ['path', 'util', ... external]},

  { input: 'code/cli_transpile.jsy',
    output: { file: './cjs/cli_transpile.cjs', sourcemap, format: 'cjs'},
    plugins, external: ['fs', 'path', 'util', ... external]},
)

if (plugins_browser)
  configs.push(
    { input: 'code/index.jsy',
      output: { file: pkg.browser, sourcemap, format: 'umd', name:'jsy_transpile' },
      plugins: plugins_browser, external},

    { input: 'code/jsy-script.jsy',
      output: [
        { file: 'esm/jsy-script.min.js', sourcemap, format: 'es'},
        { file: 'esm/jsy-script.min.mjs', sourcemap, format: 'es'},
      ],
      plugins: plugins_browser, external},
  )


add_jsy('scanner/index')
add_jsy('all')


function add_jsy(name) {
  configs.push({
    input: `code/${name}.jsy`,
    output: [
      { file: `cjs/${name}.js`, format: 'cjs', exports:'named', sourcemap },
      { file: `cjs/${name}.cjs`, format: 'cjs', exports:'named', sourcemap },
      { file: `esm/${name}.js`, format: 'es', sourcemap },
      { file: `esm/${name}.mjs`, format: 'es', sourcemap },
    ],
    plugins, external })

  if (plugins_browser)
    configs.push({
      input: `code/${name}.jsy`,
      output: { file: `umd/${name}.js`, format: 'umd', name, exports:'named', sourcemap },
      plugins: plugins_browser, external })
}
