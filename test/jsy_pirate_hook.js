/*
Inlined jsy-register require hook.
   from sister project https://github.com/jsy-lang/jsy-register
  
This local copy breaks a circular dependency and
depends upon the stable jsy-transpile build for self-hosting.
*/

require('source-map-support').install()
const pirates = require('pirates')
const { SourceMapGenerator } = require('source-map')

const jsy_transpile = require('jsy-transpile/stable')

function jsy_minimal_pirate_hook(code, filename) {
  const sourcemap = new SourceMapGenerator()

  //sourcemap.setSourceContent @ code, offside_src
  return jsy_transpile( code, {
    addSourceMapping(arg) {
      arg.source = filename
      sourcemap.addMapping(arg)
    },
    inlineSourceMap() {
      return sourcemap.toString()
    } }) }


pirates.addHook(jsy_minimal_pirate_hook, {exts: ['.js', '.mjs', '.jsy']})

